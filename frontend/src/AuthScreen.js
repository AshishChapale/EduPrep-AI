import React from 'react';
import { SignIn } from '@clerk/react';

function AuthScreen() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: '#F8FAFC',
        padding: '20px'
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ color: '#2563EB' }}>EduPrep</h1>
        <p style={{ color: '#64748B' }}>
          AI-powered exam preparation
        </p>

        <SignIn withSignUp />
      </div>
    </div>
  );
}

export default AuthScreen;