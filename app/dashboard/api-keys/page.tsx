'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Eye, EyeOff, Trash2 } from 'lucide-react';

interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed?: string;
  status: 'active' | 'revoked';
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Mock API keys - in production, fetch from API
    setApiKeys([
      {
        id: '1',
        name: 'Production API Key',
        key: 'sk_live_' + 'x'.repeat(32),
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsed: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
        status: 'active',
      },
      {
        id: '2',
        name: 'Test API Key',
        key: 'sk_test_' + 'y'.repeat(32),
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        lastUsed: undefined,
        status: 'active',
      },
    ]);
    setIsLoading(false);
  }, []);

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      setError('Please enter a key name');
      return;
    }

    setIsCreating(true);
    setError(null);
    setSuccess(null);

    try {
      // Mock API call - in production, create via API
      const newKey: ApiKey = {
        id: String(apiKeys.length + 1),
        name: keyName,
        key: 'sk_test_' + Math.random().toString(36).slice(2),
        createdAt: new Date().toISOString(),
        status: 'active',
      };

      setApiKeys([...apiKeys, newKey]);
      setSuccess(`API key "${keyName}" created successfully!`);
      setKeyName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create API key';
      setError(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyKey = (key: string, keyId: string) => {
    navigator.clipboard.writeText(key);
    setCopied(keyId);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleRevokeKey = (keyId: string) => {
    setApiKeys(
      apiKeys.map((k) =>
        k.id === keyId ? { ...k, status: 'revoked' as const } : k
      )
    );
    setSuccess('API key revoked');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
        <p className="text-muted-foreground mt-1">
          Manage your API keys for programmatic access
        </p>
      </div>

      {/* Create New Key */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Key</CardTitle>
          <CardDescription>Generate a new API key</CardDescription>
        </CardHeader>
        <CardContent>
          {success && (
            <div className="p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg mb-4">
              <p className="text-sm text-green-800 dark:text-green-200">{success}</p>
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg mb-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Key name (e.g., Development)"
              className="flex-1 px-4 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={isCreating}
              onKeyPress={(e) => e.key === 'Enter' && handleCreateKey()}
            />
            <Button onClick={handleCreateKey} disabled={isCreating}>
              {isCreating ? 'Creating...' : 'Create Key'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* API Keys List */}
      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>{apiKeys.length} key(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No API keys created yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="p-4 border border-border rounded-lg bg-muted/50 hover:bg-muted/75 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-medium text-foreground">{key.name}</h3>
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            key.status === 'active'
                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                          }`}
                        >
                          {key.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-2">
                        <code
                          className="flex-1 text-sm bg-background px-3 py-2 rounded font-mono"
                          title={key.key}
                        >
                          {showKey[key.id] ? key.key : key.key.slice(0, 8) + '•••••••••••'}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowKey({
                              ...showKey,
                              [key.id]: !showKey[key.id],
                            })
                          }
                        >
                          {showKey[key.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyKey(key.key, key.id)}
                        >
                          <Copy className="w-4 h-4" />
                          {copied === key.id && <span className="ml-1 text-xs">Copied!</span>}
                        </Button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Created{' '}
                        {new Date(key.createdAt).toLocaleDateString()}
                        {key.lastUsed && (
                          <>
                            • Last used{' '}
                            {new Date(key.lastUsed).toLocaleDateString()}
                          </>
                        )}
                      </p>
                    </div>

                    {key.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                        onClick={() => handleRevokeKey(key.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Information */}
      <Card>
        <CardHeader>
          <CardTitle>How to Use Your API Key</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium text-foreground mb-2">Add to Request Header</h4>
            <code className="block bg-muted p-3 rounded text-sm font-mono overflow-x-auto">
              {`curl -H "x-api-key: YOUR_API_KEY" \\\n  https://api.example.com/api/search`}
            </code>
          </div>
          <div>
            <h4 className="font-medium text-foreground mb-2">Keep Keys Secret</h4>
            <p className="text-sm text-muted-foreground">
              Never share your API keys publicly. Treat them like passwords. If you believe a
              key has been compromised, revoke it immediately.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
