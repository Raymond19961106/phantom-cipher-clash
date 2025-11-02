import { useState } from 'react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { SubmitForm } from './SubmitForm';
import { Dashboard } from './Dashboard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';

export function SurveyApp() {
  const { isConnected } = useAccount();
  const [activeTab, setActiveTab] = useState<'submit' | 'dashboard'>('submit');

  return (
    <div className="container mx-auto px-4 py-24 max-w-4xl">
      {!isConnected ? (
        <Card className="text-center py-12">
          <CardContent>
            <h2 className="text-2xl font-bold mb-4">Connect Your Wallet</h2>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to submit surveys or view management statistics
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'submit' | 'dashboard')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="submit">Submit Survey</TabsTrigger>
            <TabsTrigger value="dashboard">Management Dashboard</TabsTrigger>
          </TabsList>
          
          <TabsContent value="submit">
            <SubmitForm />
          </TabsContent>
          
          <TabsContent value="dashboard">
            <Dashboard />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}



