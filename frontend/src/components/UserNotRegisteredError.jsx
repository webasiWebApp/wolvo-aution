import React from 'react';

const LOGO_URL = 'https://media.base44.com/images/public/6acf0f20dea3206601d70422/87021ca00_generated_image.png';

const UserNotRegisteredError = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-primary px-4 py-10">
      <img src={LOGO_URL} alt="Wolvo" className="h-14 w-14 rounded-xl object-cover mb-6" />
      <div className="max-w-md w-full p-8 bg-card rounded-2xl shadow-xl border border-border">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 mb-5 rounded-full bg-accent/15 text-accent">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-3">Access restricted</h1>
          <p className="text-muted-foreground mb-6">
            You are not registered to use Wolvo. Please contact the administrator to request access.
          </p>
          <div className="p-4 bg-muted rounded-md text-sm text-muted-foreground text-left">
            <p>If you believe this is an error, you can:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Verify you are logged in with the correct account</li>
              <li>Contact the administrator for access</li>
              <li>Try logging out and back in again</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;