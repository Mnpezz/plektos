// NOTE: This file is stable and usually should not be modified.
// It is important that all functionality in this file is preserved, and should only be modified if explicitly requested.

import React, { useState } from 'react';
import { Download, Key } from 'lucide-react';
import { Button } from '@/components/ui/button.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.tsx';
import { toast } from 'sonner';
import { generateSecretKey, nip19 } from 'nostr-tools';
import { NLogin, useNostrLogin } from '@nostrify/react/login';

interface SignupDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const SignupDialog: React.FC<SignupDialogProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState<'generate' | 'download' | 'done'>('generate');
  const [isLoading, setIsLoading] = useState(false);
  const [nsec, setNsec] = useState('');
  const { addLogin } = useNostrLogin();

  const shouldBeOpen = isOpen;





  // Generate a proper nsec key using nostr-tools
  const generateKey = () => {
    setIsLoading(true);
    
    try {
      // Generate a new secret key
      const sk = generateSecretKey();
      
      // Convert to nsec format
      const nsecKey = nip19.nsecEncode(sk);
      
      setNsec(nsecKey);
      setStep('download');
    } catch (error) {
      console.error('Failed to generate key:', error);
      toast.error('Failed to generate key. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const downloadKey = () => {
    // Create a blob with the key text
    const blob = new Blob([nsec], { type: 'text/plain' });
    const url = globalThis.URL.createObjectURL(blob);

    // Create a temporary link element and trigger download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nsec.txt';
    document.body.appendChild(a);
    a.click();

    // Clean up
    globalThis.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    toast.success('Your key has been downloaded. Keep it safe!');
  };

  const finishSignup = () => {
    setIsLoading(true);
    try {
      const loginObj = NLogin.fromNsec(nsec);
      addLogin(loginObj);
      setStep('done');
      onClose();
      toast.success('Account created! You are now logged in.');
    } catch (error) {
      console.error('Failed to log in user:', error);
      toast.error('Failed to log in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };



  // Handle dialog open/close changes
  const handleDialogOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <>
      <Dialog 
        open={shouldBeOpen} 
        onOpenChange={handleDialogOpenChange}
      >
        <DialogContent className='sm:max-w-md p-0 overflow-hidden rounded-2xl'>
          <DialogHeader className='px-6 pt-6 pb-0 relative'>
            <DialogTitle className='text-xl font-semibold text-center'>
              {step === 'generate' && 'Create Your Account'}
              {step === 'download' && 'Download Your Key'}
              {step === 'done' && 'Setting Up Your Account'}
            </DialogTitle>
            <DialogDescription className='text-center text-muted-foreground mt-2'>
              {step === 'generate' && 'Generate a secure key for your account'}
              {step === 'download' && "Keep your key safe - you'll need it to log in"}
              {step === 'done' && 'Finalizing your account setup'}
            </DialogDescription>
          </DialogHeader>

          <div className='px-6 py-8 space-y-6'>
            {step === 'generate' && (
              <div className='text-center space-y-6 animate-slide-up'>
                <div className='p-6 rounded-2xl bg-party-gradient flex items-center justify-center'>
                  <Key className='w-16 h-16 text-white' />
                </div>
                <div className='space-y-3'>
                  <h3 className='text-lg font-semibold'>Welcome to Plektos! 🎉</h3>
                  <p className='text-sm text-muted-foreground'>
                    We'll generate a secure key for your account. You'll need this key to log in later.
                  </p>
                </div>
                <Button
                  className='w-full rounded-2xl py-6 text-lg font-medium'
                  onClick={generateKey}
                  disabled={isLoading}
                >
                  {isLoading ? 'Generating key...' : 'Generate my key'}
                </Button>
              </div>
            )}

            {step === 'download' && (
              <div className='space-y-6 animate-slide-up'>
                <div className='p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 overflow-auto'>
                  <code className='text-xs break-all font-mono'>{nsec}</code>
                </div>

                <div className='text-sm space-y-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20'>
                  <p className='font-semibold text-destructive flex items-center'>
                    🔒 Keep this safe!
                  </p>
                  <ul className='space-y-1 text-muted-foreground'>
                    <li>• This is your only way to access your account</li>
                    <li>• Store it somewhere safe (password manager recommended)</li>
                    <li>• Never share this key with anyone</li>
                  </ul>
                </div>

                <div className='flex flex-col space-y-3'>
                  <Button
                    variant='outline'
                    className='w-full rounded-xl py-3'
                    onClick={downloadKey}
                  >
                    <Download className='w-4 h-4 mr-2' />
                    Download Key File
                  </Button>

                  <Button
                    className='w-full rounded-2xl py-6 text-lg font-medium bg-party-gradient hover:opacity-90 transition-opacity'
                    onClick={finishSignup}
                    disabled={isLoading}
                  >
                    {isLoading ? 'Logging you in...' : 'I\'ve saved my key, continue'}
                  </Button>
                </div>
              </div>
            )}

            {step === 'done' && (
              <div className='flex justify-center items-center py-8'>
                <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-primary'></div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SignupDialog;