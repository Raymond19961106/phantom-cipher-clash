import { ConnectButton } from '@rainbow-me/rainbowkit';
import { Shield } from 'lucide-react';

export function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b bg-card">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-primary">Encrypted Satisfaction Survey</h1>
              <p className="text-sm text-muted-foreground">Privacy-Preserving Employee Feedback</p>
            </div>
          </div>
          
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}


