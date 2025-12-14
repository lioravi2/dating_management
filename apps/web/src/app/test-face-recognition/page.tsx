'use client';

import { PhotoUploadWithFaceMatch } from '@/components/PhotoUploadWithFaceMatch';
import { useState } from 'react';

export default function TestFaceRecognitionPage() {
  const [selectedPartnerId, setSelectedPartnerId] = useState<string>('');

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Face Recognition Test</h1>

      <div className="mb-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Test Mode:
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                name="mode"
                value=""
                checked={selectedPartnerId === ''}
                onChange={() => setSelectedPartnerId('')}
                className="mr-2"
              />
              Upload without partner (Use Case 2)
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="mode"
                value="with-partner"
                checked={selectedPartnerId !== ''}
                onChange={() => {
                  const partnerId = prompt('Enter partner ID:');
                  if (partnerId) setSelectedPartnerId(partnerId);
                }}
                className="mr-2"
              />
              Upload to specific partner (Use Case 1)
            </label>
            {selectedPartnerId && (
              <p className="text-sm text-gray-600 ml-6">
                Partner ID: {selectedPartnerId}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="border rounded-lg p-6">
        <PhotoUploadWithFaceMatch
          partnerId={selectedPartnerId || undefined}
          onSuccess={() => {
            alert('Photo uploaded successfully!');
          }}
          onCancel={() => {
            console.log('Upload cancelled');
          }}
        />
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded">
        <h2 className="font-bold mb-2">Test Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Select a photo with a face</li>
          <li>If multiple faces are detected, you'll be asked to select one</li>
          <li>The system will analyze the face and show appropriate warnings</li>
          <li>Follow the prompts to complete the upload</li>
        </ol>
      </div>
    </div>
  );
}
