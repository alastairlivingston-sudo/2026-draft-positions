"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Copy, MessageCircle, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const LEAGUE_PATH = "/league/world-cup-draft";

function useLeagueUrl() {
  if (typeof window === "undefined") return LEAGUE_PATH;
  return `${window.location.origin}${LEAGUE_PATH}`;
}

export function ShareBar() {
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const url = useLeagueUrl();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard API unavailable; silently ignore for MVP.
    }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`Check out our World Cup Draft fantasy league: ${url}`)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={handleCopy} className="gap-1.5">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied!" : "Copy invite link"}
      </Button>
      <Button
        render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
        size="sm"
        variant="secondary"
        className="gap-1.5"
      >
        <MessageCircle className="h-4 w-4" />
        WhatsApp
      </Button>
      <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => setQrOpen(true)}>
        <QrCode className="h-4 w-4" />
        QR code
      </Button>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Scan to open the league</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="rounded-2xl bg-white p-4">
              <QRCodeSVG value={url} size={200} />
            </div>
            <p className="text-center text-xs text-muted-foreground break-all">{url}</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
