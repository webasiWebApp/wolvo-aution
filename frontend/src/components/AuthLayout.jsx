import React from "react";

const LOGO_URL = "https://media.base44.com/images/public/6acf0f20dea3206601d70422/87021ca00_generated_image.png";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-primary px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={LOGO_URL} alt="Wolvo" className="h-14 w-14 rounded-xl object-cover mx-auto mb-4" />
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-accent/15 text-accent mb-3">
            <Icon className="w-6 h-6" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground">{title}</h1>
          {subtitle && <p className="text-primary-foreground/70 mt-2">{subtitle}</p>}
        </div>
        <div className="bg-card rounded-2xl shadow-xl border border-border p-8">
          {children}
        </div>
        {footer && (
          <p className="text-center text-sm text-primary-foreground/70 mt-6">{footer}</p>
        )}
      </div>
    </div>
  );
}