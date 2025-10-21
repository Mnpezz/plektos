import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, AlertCircle, Camera, QrCode, Clipboard, X, RefreshCw } from "lucide-react";
import { useNostr } from "@nostrify/react";
import { useQuery } from "@tanstack/react-query";
import { useNostrPublish } from "@/hooks/useNostrPublish";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { nip19 } from "nostr-tools";
import { Link } from "react-router-dom";
import { toast } from "sonner";
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

  // Function to manually check in an attendee
  const handleManualCheckIn = async (buyerPubkey: string, eventId: string, receiptId?: string) => {
    if (!user?.signer) {
      toast.error("Please log in to check in attendees");
      return;
    }

    try {
      const checkInEvent = {
        kind: 31926, // Entry tracking event
        content: `Manual check-in by event host`,
        created_at: Math.floor(Date.now() / 1000),
        tags: [
          ["e", eventId], // Event ID
          ["p", buyerPubkey], // Attendee pubkey
          ["timestamp", Math.floor(Date.now() / 1000).toString()], // Check-in timestamp
          ...(receiptId ? [["receipt", receiptId]] : []), // Specific receipt ID if provided
        ],
      };

      const signedEvent = await user.signer.signEvent(checkInEvent);
      await nostr.event(signedEvent);

      toast.success("Attendee checked in successfully!");
      
      // Refresh the check-in data
      window.location.reload();
    } catch (error) {
      console.error("Error checking in attendee:", error);
      toast.error("Failed to check in attendee");
    }
  };
  const { user } = useCurrentUser();
  const [ticketData, setTicketData] = useState<TicketData | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'valid' | 'invalid' | 'error'>('loading');
  const [manualInput, setManualInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [isMarkingAsEntered, setIsMarkingAsEntered] = useState(false);
  const [entryStatus, setEntryStatus] = useState<'not_checked' | 'checked_in' | 'already_entered'>('not_checked');
  const [isEventHost, setIsEventHost] = useState<boolean | null>(null);
  const [isCheckingEventHost, setIsCheckingEventHost] = useState(true);
  const [myEvents, setMyEvents] = useState<unknown[]>([]);
  const [_checkedInAttendees, setCheckedInAttendees] = useState<unknown[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventTicketSales, setEventTicketSales] = useState<unknown[]>([]);
  const [eventCheckIns, setEventCheckIns] = useState<unknown[]>([]);
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

  // Check if current user is an event host and load their events
  useEffect(() => {
    const checkEventHostStatus = async () => {
      try {
        setIsCheckingEventHost(true);
        
        // Check if user is available
        if (!user?.pubkey) {
          console.log('❌ No user pubkey available');
          setIsEventHost(false);
          setIsCheckingEventHost(false);
          return;
        }
        
        // Get current user's events with timeout (same query as Profile page)
        const userEvents = await nostr.query([
          { 
            kinds: [31922, 31923], // Date and time-based events only
            authors: [user.pubkey] // Filter by current user
          }
        ], { 
          signal: AbortSignal.timeout(3000) // 3 second timeout like Profile page
        }) as unknown[];

        if (userEvents.length > 0) {
          setIsEventHost(true);
          setMyEvents(userEvents);
          
          // Load checked-in attendees for all events (with shorter timeout)
          const allEntryEvents: unknown[] = [];
          for (const event of userEvents) {
            try {
              const eventWithId = event as { id: string; tags: string[][] };
              const entryEvents = await nostr.query([
                {
                  kinds: [31926], // Entry tracking events
                  "#e": [eventWithId.id],
                  limit: 100
                }
              ], { 
                signal: AbortSignal.timeout(2000) // 2 second timeout for entry events
              }) as unknown[];
              
              allEntryEvents.push(...entryEvents.map((entry: unknown) => ({
                ...(entry as Record<string, unknown>),
                eventTitle: eventWithId.tags.find((tag: string[]) => tag[0] === "title")?.[1] || "Untitled Event",
                eventId: eventWithId.id
              })));
            } catch (error) {
              const eventWithId = event as { id: string };
              console.warn('Error loading entry events for event:', eventWithId.id, error);
            }
          }
          
                  setCheckedInAttendees(allEntryEvents);
                } else {
                  setIsEventHost(false);
                }
      } catch (error) {
        console.error('Error checking event host status:', error);
        // Don't set isEventHost to false on timeout - let user try again
        if (error instanceof Error && error.message.includes('timeout')) {
          console.log('⏰ Query timed out - will retry on next visit');
        } else {
          setIsEventHost(false);
        }
      } finally {
        setIsCheckingEventHost(false);
      }
    };

    checkEventHostStatus();
  }, [nostr, user]);

  // Load ticket sales and check-ins for selected event
  useEffect(() => {
    const loadEventData = async () => {
      if (!selectedEventId || !nostr || !user?.pubkey) return;

      try {
    // Load ticket sales (zap receipts where current user is the recipient)
        
        let ticketSales;
        try {
          ticketSales = await nostr.query([
            {
              kinds: [9735], // Zap receipts
              "#p": [user.pubkey], // Where current user is the recipient
              limit: 100
            }
          ], { signal: AbortSignal.timeout(5000) }); // 5 second timeout
        } catch (error) {
          console.error('Error querying ticket sales:', error);
          ticketSales = []; // Fallback to empty array
        }

        // Load check-ins (entry events for this event)
        const checkIns = await nostr.query([
          {
            kinds: [31926], // Entry tracking events
            "#e": [selectedEventId],
            limit: 100
          }
        ]);


        // Filter ticket sales to only those for the selected event
        // AND exclude our system-created zap receipts (they have "manual_payment_confirmed" preimage)
        const eventTicketSales = ticketSales.filter((sale: { tags: string[][] }) => {
          // Check if this zap receipt is for the selected event
          const eventId = sale.tags.find((tag: string[]) => tag[0] === "e")?.[1];
          if (eventId !== selectedEventId) return false;
          
          // Exclude our system-created zap receipts (they have "manual_payment_confirmed" preimage)
          const preimage = sale.tags.find((tag: string[]) => tag[0] === "preimage")?.[1];
          if (preimage === "manual_payment_confirmed") return false;
          
          return true;
        });


        setEventTicketSales(eventTicketSales);
        setEventCheckIns(checkIns);
      } catch (error) {
        console.error('Error loading event data:', error);
      }
    };

    loadEventData();
  }, [selectedEventId, nostr, user]);

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
  const checkEntryStatus = useCallback(async () => {
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
  }, [ticketData, nostr]);

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
          // Re-check entry status to ensure UI updates
          setTimeout(() => {
            checkEntryStatus();
          }, 1000);
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
  }, [ticketData, checkEntryStatus]);

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
      if (!ticketData?.receiptId) return null;

      const events = await nostr.query([
        {
          kinds: [9735], // Zap receipt
          ids: [ticketData.receiptId],
          "#e": [ticketData.eventId],
        },
      ]);
      return events[0] || null;
    },
    enabled: !!ticketData?.receiptId,
  });

  useEffect(() => {
    if (ticketData && !isLoading) {
      // Verify ticket data
      if (zapReceipt) {
        console.log('✅ Ticket verified successfully');
        setVerificationStatus('valid');
      } else {
        console.log('❌ Ticket verification failed - no zap receipt found');
        setVerificationStatus('invalid');
      }
    }
  }, [ticketData, zapReceipt, isLoading]);

  // Always show the ticket verification interface
  if (!ticketData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Ticket Verification Section - Always Visible */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-center flex items-center justify-center gap-2">
                <QrCode className="h-6 w-6" />
                Ticket Verification
              </CardTitle>
              <p className="text-center text-gray-600 text-sm">
                Scan or enter ticket data to verify attendance
              </p>
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

          {/* Event Host Dashboard - Separate Section */}
          {isEventHost && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-center flex items-center justify-center gap-2">
                  <QrCode className="h-6 w-6" />
                  Event Host Dashboard
                  {isCheckingEventHost && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
                  )}
                </CardTitle>
                <p className="text-center text-gray-600 text-sm">
                  Select an event to manage ticket sales and check-ins
                  {isCheckingEventHost && (
                    <span className="block text-xs text-blue-600 mt-1">
                      Loading your events...
                    </span>
                  )}
                </p>
              </CardHeader>
              <CardContent>
                {/* Event Selection Dropdown */}
                <div className="space-y-4 mb-6">
                  <div className="space-y-2">
                    <Label htmlFor="event-select">Select Event to Manage</Label>
                            <select
                              id="event-select"
                              value={selectedEventId || ''}
                              onChange={(e) => setSelectedEventId(e.target.value || null)}
                              className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                            >
                      <option value="">Choose an event...</option>
                      {myEvents.map((event, index) => {
                        const eventData = event as { id: string; tags: string[][] };
                        const title = eventData.tags.find((tag: string[]) => tag[0] === "title")?.[1] || "Untitled Event";
                        return (
                          <option key={index} value={eventData.id}>
                            {title}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>

                {/* Event-Specific Data */}
                {selectedEventId && (
                  <div className="space-y-6">
                    {/* Ticket Sales Summary */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="text-lg font-semibold text-amber-800 mb-3">
                        🎫 Ticket Management ({eventTicketSales.length} tickets)
                      </h3>
                      {eventTicketSales.length > 0 ? (
                        <div className="space-y-2">
                          {eventTicketSales
                            .sort((a, b) => {
                              const aData = a as { created_at: number };
                              const bData = b as { created_at: number };
                              return aData.created_at - bData.created_at; // Oldest first
                            })
                            .map((sale, index) => {
                            const saleData = sale as { 
                              id: string; 
                              pubkey: string; 
                              created_at: number; 
                              tags: string[][];
                            };
                            
                            // Parse zap request to get amount and buyer pubkey
                            const descriptionTag = saleData.tags.find((tag: string[]) => tag[0] === "description")?.[1];
                            let amount = 0;
                            let buyerPubkey = saleData.pubkey; // Default to zap receipt author
                            
                            if (descriptionTag) {
                              try {
                                const zapRequest = JSON.parse(descriptionTag);
                                const amountTag = zapRequest.tags?.find((tag: string[]) => tag[0] === "amount");
                                if (amountTag) {
                                  amount = Math.floor(parseInt(amountTag[1]) / 1000); // Convert from millisats to sats
                                }
                                // Get buyer pubkey from zap request author
                                if (zapRequest.pubkey) {
                                  buyerPubkey = zapRequest.pubkey;
                                }
                              } catch (error) {
                                console.error("Error parsing zap request:", error);
                              }
                            }

                            // Check if this specific ticket has been checked in
                            const isCheckedIn = eventCheckIns.some((checkIn: { tags: string[][] }) => {
                              const checkInBuyer = checkIn.tags.find((tag) => tag[0] === "p")?.[1];
                              const checkInEvent = checkIn.tags.find((tag) => tag[0] === "e")?.[1];
                              const checkInReceipt = checkIn.tags.find((tag) => tag[0] === "receipt")?.[1];
                              
                              // Match by buyer and event first
                              if (checkInBuyer === buyerPubkey && checkInEvent === selectedEventId) {
                                // If there's a receipt tag, match by receipt ID (new check-ins)
                                if (checkInReceipt) {
                                  return checkInReceipt === saleData.id;
                                } else {
                                  // If no receipt tag, this is an old check-in - match by buyer and event only
                                  return true;
                                }
                              }
                              return false;
                            });

                            return (
                                      <div key={index} className="bg-white border border-amber-300 rounded-lg p-3">
                                        <div className="flex justify-between items-center">
                                          <div className="flex-1">
                                            <span className="font-medium text-amber-800">
                                              Ticket #{index + 1}
                                            </span>
                                            <p className="text-amber-600 text-sm">
                                              Buyer: <Link to={`/profile/${nip19.npubEncode(buyerPubkey)}`} className="text-blue-600 hover:text-blue-800 underline">{buyerPubkey.slice(0, 8)}...</Link>
                                            </p>
                                            <p className="text-amber-600 text-sm">
                                              Purchased: {new Date(saleData.created_at * 1000).toLocaleString()}
                                            </p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="bg-amber-100 text-amber-800">
                                              💰 {amount} sats
                                            </Badge>
                                            {isCheckedIn ? (
                                              <Badge variant="outline" className="bg-green-100 text-green-800">
                                                ✅ Checked In
                                              </Badge>
                                            ) : (
                                                <Button
                                                size="sm"
                                                onClick={() => handleManualCheckIn(buyerPubkey, selectedEventId!, saleData.id)}
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                              >
                                                ✓ Check In
                                              </Button>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-amber-600">No ticket sales yet</p>
                      )}
                    </div>

                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center text-2xl flex items-center justify-center gap-2">
            {verificationStatus === 'loading' && <AlertCircle className="h-6 w-6 animate-pulse text-blue-500" />}
            {verificationStatus === 'valid' && <CheckCircle className="h-6 w-6 text-green-500" />}
            {verificationStatus === 'invalid' && <XCircle className="h-6 w-6 text-red-500" />}
            {verificationStatus === 'error' && <AlertCircle className="h-6 w-6 text-yellow-500" />}
            Ticket Verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="text-center text-gray-500">
              <AlertCircle className="h-6 w-6 mx-auto mb-2 animate-spin" />
              <p>Verifying ticket on Nostr network...</p>
            </div>
          )}

          {ticketData && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Event:</span>
                <span className="font-medium text-right">{ticketData.eventTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Buyer:</span>
                <span className="font-mono text-xs text-right">{ticketData.buyerPubkey.slice(0, 8)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Amount:</span>
                <Badge variant="secondary" className="text-xs">
                  {ticketData.amount} sats
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Purchased:</span>
                <span className="text-right">{new Date(ticketData.purchaseTime * 1000).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Event ID:</span>
                <span className="font-mono text-xs">{ticketData.eventId.slice(0, 8)}...</span>
              </div>
            </div>
          )}

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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkEntryStatus}
                    className="w-full mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              )}
              
              {entryStatus === 'checked_in' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm text-center">
                    ✅ Attendee has been successfully checked in!
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={checkEntryStatus}
                    className="w-full mt-2"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Refresh Status
                  </Button>
                </div>
              )}
              
              {entryStatus === 'not_checked' && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-gray-800 text-sm text-center">
                    📋 This attendee has not been checked in yet.
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
