import React from 'react';
import { useAuth } from '@/context/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { IconBolt } from '@tabler/icons-react';
import GradientWaves from '@/components/LoginBG';

export const LoginPage: React.FC = () => {
  const { loginWithGoogle, devLogin, loading } = useAuth();

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Top-Right Theme Switcher */}
      <div className="absolute top-5 right-5 z-20">
        <ThemeToggle className="bg-card/85 backdrop-blur-md border-border/80 shadow-md" />
      </div>

      {/* Background WebGL Shader Waves */}
      <div className="fixed inset-0 z-0 pointer-events-auto">
        <GradientWaves
          horizonColor="#10B981"
          waveColor="#047857"
          crestColor="#18181b"
          speed={0.35}
          amplitude={2.5}
          waveScale={0.6}
          waveRatio={0.9}
          swell={35}
          turbulence={20}
          tilt={1.11}
          zoom={1}
          height={5.5}
          fogDepth={15}
          detail="medium"
          brightness={1}
          opacity={0.85}
          mouseInteraction
          parallaxStrength={0.5}
          grain
          grainIntensity={0.025}
        />
      </div>

      {/* Foreground Content Centered Top-Center */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-start pt-12 sm:pt-34 md:pt-40 px-4 pb-12">
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center text-center space-y-1">
          <span className="font-heading text-4xl font-extrabold tracking-tight text-foreground drop-shadow-xs">
            ReachInbox
          </span>
          <p className="text-sm text-muted-foreground font-medium max-w-sm pt-1">
            Zero-Drop Scheduled Email Engine & Rate-Limit Resilience
          </p>
        </div>

        {/* Glassmorphic Login Card */}
        <Card className="w-full max-w-[420px] border-border/80 bg-card/85 dark:bg-card/75 backdrop-blur-xl p-8 shadow-2xl rounded-2xl">
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold text-foreground">Sign In</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Access your campaigns, queue metrics & analytics
            </p>
          </div>

          <div className="mt-6 space-y-4">
            {/* Google Login Button */}
            <Button
              onClick={loginWithGoogle}
              disabled={loading}
              className="w-full h-11 bg-card hover:bg-muted/80 text-foreground border border-border rounded-xl font-medium text-sm flex items-center justify-center gap-3 transition-all shadow-xs cursor-pointer"
              variant="outline"
            >
              {/* Google G SVG */}
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
            </Button>

            {/* Quick Dev Demo Helper */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={devLogin}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground underline focus:outline-none cursor-pointer transition-colors"
              >
                <IconBolt className="h-3.5 w-3.5 text-amber-500" />
                <span>Quick 1-Click Demo Login (Oliver Brown)</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

