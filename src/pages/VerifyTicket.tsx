import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertCircle, Camera, QrCode, Clipboard, X } from "lucide-react";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import QrScanner from "qr-scanner";

interface TicketData {
  eventId: string;
  receiptId: string;
  amount: number;
  buyerPubkey: string;
  eventTitle: string;
  purchaseTime: number;
}

export function VerifyTicket() {
  const [searchParams] = useSearchParams();
  const { nostr } = useNostr();
  const { mutate: publishEvent } = useNostrPublish();
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading');
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isMarkingAsEntered, setIsMarkingAsEntered] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'not_checked' | 'checked_in' | 'already_entered'>('not_checked');
  const videoRef = useRef<HTMLVideoElement>(null);
  const qrScannerRef = useRef<QrScanner | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(dataParam));
        setTicketData(decoded);
      } catch (error) {
        console.error('Error parsing ticket data:', error);
        setVerificationStatus('error');
      }
    }
  }, [searchParams]);

  const handleManualInput = () => {
    if (!manualInput.trim()) return;
    
    try {
      // Try to parse as JSON first (full ticket data)
      const decoded = JSON.parse(manualInput);
      setTicketData(decoded);
    } catch {
      // If not JSON, try to parse as URL with data parameter
      try {
        const url = new URL(manualInput);
        const dataParam = url.searchParams.get('data');
        if (dataParam) {
          const decoded = JSON.parse(decodeURIComponent(dataParam));
          setTicketData(decoded);
        } else {
          setVerificationStatus('error');
        }
      } catch {
        setVerificationStatus('error');
      }
    }
  };

  const handleQRScan = async () => {
    try {
      setIsScanning(true);
      setScannerError(null);
      
      if (!videoRef.current) return;
      
      // Check if camera is available
      const hasCamera = await QrScanner.hasCamera();
      if (!hasCamera) {
        setScannerError('No camera found. Please use manual input instead.');
        setIsScanning(false);
        return;
      }
      
      // Create QR scanner
      qrScannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          // QR code detected
          try {
            const decoded = JSON.parse(result.data);
            setTicketData(decoded);
            stopScanner();
          } catch {
            // Try to parse as URL with data parameter
            try {
              const url = new URL(result.data);
              const dataParam = url.searchParams.get('data');
              if (dataParam) {
                const decoded = JSON.parse(decodeURIComponent(dataParam));
                setTicketData(decoded);
                stopScanner();
              } else {
                setScannerError('Invalid QR code format. Please try again.');
              }
            } catch {
              setScannerError('Invalid QR code format. Please try again.');
            }
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        }
      );
      
      await qrScannerRef.current.start();
    } catch (error) {
      console.error('QR Scanner error:', error);
      setScannerError('Failed to start camera. Please check permissions and try again.');
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (qrScannerRef.current) {
      qrScannerRef.current.stop();
      qrScannerRef.current.destroy();
      qrScannerRef.current = null;
    }
    setIsScanning(false);
  };

  // Check if attendee has already entered
  const checkEntryStatus = async () => {
    if (!ticketData) return;
    
    try {
      // Look for existing entry events for this ticket
      const entryEvents = await nostr.query([
        {
          kinds: [31926], // Custom kind for entry tracking
          "#e": [ticketData.eventId],
          "#p": [ticketData.buyerPubkey],
          "#t": ["entry"]
        }
      ]);
      
      if (entryEvents.length > 0) {
        setEntryStatus('already_entered');
      } else {
        setEntryStatus('not_checked');
      }
    } catch (error) {
      console.error('Error checking entry status:', error);
    }
  };

  // Mark attendee as entered
  const markAsEntered = async () => {
    if (!ticketData) return;
    
    setIsMarkingAsEntered(true);
    try {
      // Create entry tracking event
      const entryEvent = {
        kind: 31926,
        content: `Attendee checked in for ${ticketData.eventTitle}`,
        tags: [
          ["e", ticketData.eventId],
          ["p", ticketData.buyerPubkey],
          ["t", "entry"],
          ["status", "entered"],
          ["timestamp", Math.floor(Date.now() / 1000).toString()]
        ]
      };
      
      // Publish entry event
      publishEvent(entryEvent, {
        onSuccess: () => {
          setEntryStatus('checked_in');
          alert('Attendee successfully checked in!');
        },
        onError: (error) => {
          console.error('Error marking as entered:', error);
          alert('Failed to check in attendee. Please try again.');
        }
      });
    } catch (error) {
      console.error('Error marking as entered:', error);
      alert('Failed to check in attendee. Please try again.');
    } finally {
      setIsMarkingAsEntered(false);
    }
  };

  // Check entry status when ticket data changes
  useEffect(() => {
    if (ticketData) {
      checkEntryStatus();
    }
  }, [ticketData]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Verify the ticket by checking the zap receipt
  const { data: zapReceipt, isLoading } = useQuery({
    queryKey: ["verifyTicket", ticketData?.receiptId],
    queryFn: async () => {
      if (!ticketData) return null;
      
      const events = await nostr.query([
        {
          kinds: [9735], // Zap receipt
          ids: [ticketData.receiptId]
        }
      ]);
      
      return events[0] || null;
    },
    enabled: !!ticketData,
  });

  useEffect(() => {
    if (ticketData && zapReceipt) {
      // Verify the ticket
      const isValid = 
        zapReceipt.id === ticketData.receiptId &&
        zapReceipt.pubkey === ticketData.buyerPubkey &&
        zapReceipt.tags.some(tag => tag[0] === 'e' && tag[1] === ticketData.eventId);
      
      setVerificationStatus(isValid ? 'valid' : 'invalid');
    } else if (ticketData && !isLoading && !zapReceipt) {
      setVerificationStatus('invalid');
    }
  }, [ticketData, zapReceipt, isLoading]);

  if (!ticketData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <QrCode className="h-6 w-6" />
                Ticket Verification
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="scan" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="scan" className="flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Scan QR Code
                  </TabsTrigger>
                  <TabsTrigger value="manual" className="flex items-center gap-2">
                    <Clipboard className="h-4 w-4" />
                    Manual Input
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="scan" className="space-y-4">
                  <div className="text-center">
                    <p className="text-gray-600 mb-4">
                      Scan the QR code from the attendee's ticket
                    </p>
                    
                    {/* Video element for QR scanning */}
                    <div className="relative mb-4">
                      <video
                        ref={videoRef}
                        className="w-full max-w-md mx-auto rounded-lg border-2 border-dashed border-gray-300"
                        style={{ display: isScanning ? 'block' : 'none' }}
                      />
                      {!isScanning && (
                        <div className="w-full max-w-md mx-auto h-48 bg-gray-100 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <div className="text-center text-gray-500">
                            <Camera className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Camera will appear here</p>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Scanner controls */}
                    <div className="space-y-2">
                      <Button 
                        onClick={handleQRScan} 
                        disabled={isScanning}
                        className="w-full"
                        size="lg"
                      >
                        {isScanning ? (
                          <>
                            <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <Camera className="h-4 w-4 mr-2" />
                            Start QR Scanner
                          </>
                        )}
                      </Button>
                      
                      {isScanning && (
                        <Button 
                          onClick={stopScanner}
                          variant="outline"
                          className="w-full"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Stop Scanner
                        </Button>
                      )}
                    </div>
                    
                    {/* Error message */}
                    {scannerError && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
                        <p className="text-red-800 text-sm text-center">
                          {scannerError}
                        </p>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-2">
                      Note: QR scanner requires camera permission
                    </p>
                  </div>
                </TabsContent>
                
                <TabsContent value="manual" className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="ticket-input">Ticket Data or URL</Label>
                    <Input
                      id="ticket-input"
                      placeholder="Paste ticket data or verification URL here..."
                      value={manualInput}
                      onChange={(e) => setManualInput(e.target.value)}
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500">
                      Paste either the full ticket JSON data or the verification URL
                    </p>
                  </div>
                  <Button 
                    onClick={handleManualInput}
                    disabled={!manualInput.trim()}
                    className="w-full"
                  >
                    Verify Ticket
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-center text-gray-600">
                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                No Ticket Data
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-center text-gray-600">
                Use the scanner or manual input above to verify a ticket.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">
            {verificationStatus === 'loading' && (
              <>
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                Verifying Ticket...
              </>
            )}
            {verificationStatus === 'valid' && (
              <>
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                Valid Ticket
              </>
            )}
            {verificationStatus === 'invalid' && (
              <>
                <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                Invalid Ticket
              </>
            )}
            {verificationStatus === 'error' && (
              <>
                <XCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                Verification Error
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Event Info */}
          <div className="text-center">
            <h3 className="font-semibold text-lg">{ticketData.eventTitle}</h3>
            <div className="flex justify-center gap-2 mt-2">
              <Badge variant="outline" className="bg-amber-500/10 text-amber-500">
                🎟️ {ticketData.amount} sats
              </Badge>
            </div>
          </div>

          {/* Verification Details */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Purchased:</span>
              <span>{new Date(ticketData.purchaseTime * 1000).toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Buyer:</span>
              <span className="font-mono text-xs">{ticketData.buyerPubkey.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Event ID:</span>
              <span className="font-mono text-xs">{ticketData.eventId.slice(0, 8)}...</span>
            </div>
          </div>

          {/* Status Message */}
          {verificationStatus === 'valid' && (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <p className="text-green-800 text-sm text-center">
                  ✅ This ticket is valid and has been verified on the Nostr network.
                </p>
              </div>
              
              {/* Entry Status */}
              {entryStatus === 'already_entered' && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <p className="text-orange-800 text-sm text-center">
                    ⚠️ This attendee has already been checked in for this event.
                  </p>
                </div>
              )}
              
              {entryStatus === 'checked_in' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm text-center">
                    ✅ Attendee has been successfully checked in!
                  </p>
                </div>
              )}
            </div>
          )}

          {verificationStatus === 'invalid' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-red-800 text-sm text-center">
                ❌ This ticket could not be verified. It may be fake or expired.
              </p>
            </div>
          )}

          {verificationStatus === 'error' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-yellow-800 text-sm text-center">
                ⚠️ There was an error verifying this ticket. Please try again.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            {verificationStatus === 'valid' && entryStatus === 'not_checked' && (
              <Button 
                onClick={markAsEntered}
                disabled={isMarkingAsEntered}
                className="w-full"
                size="lg"
              >
                {isMarkingAsEntered ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2 animate-spin" />
                    Checking In...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Check In Attendee
                  </>
                )}
              </Button>
            )}
            
            {verificationStatus === 'valid' && entryStatus === 'already_entered' && (
              <div className="bg-orange-100 border border-orange-300 rounded-lg p-3">
                <p className="text-orange-800 text-sm text-center font-medium">
                  This attendee has already been checked in
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => {
                  setTicketData(null);
                  setVerificationStatus('loading');
                  setManualInput('');
                  setEntryStatus('not_checked');
                }}
              >
                Verify Another
              </Button>
              
              {verificationStatus === 'valid' && entryStatus === 'checked_in' && (
                <Button 
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setTicketData(null);
                    setVerificationStatus('loading');
                    setManualInput('');
                    setEntryStatus('not_checked');
                  }}
                >
                  Done
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
