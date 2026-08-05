import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  disablePush,
  enablePush,
  isPushEnabled,
  pushSupported,
  syncPushSubscription,
} from "@/lib/push-client";

/** Header toggle that turns device (WhatsApp-style) notifications on or off. */
export function PushToggle({ className = "" }: { className?: string }) {
  const [supported, setSupported] = useState(false);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    isPushEnabled().then((v) => {
      setOn(v);
      if (v) void syncPushSubscription();
    });
  }, []);

  if (!supported) return null;

  const toggle = async () => {
    setBusy(true);
    try {
      if (on) {
        await disablePush();
        setOn(false);
        toast.success("Notifications turned off on this device");
      } else {
        const ok = await enablePush();
        setOn(ok);
        toast[ok ? "success" : "error"](
          ok
            ? "Notifications on — you'll be alerted about new materials and deadlines"
            : "Notifications were blocked. Allow them in your browser settings to get alerts.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change notifications");
    } finally {
      setBusy(false);
    }
  };

  const Icon = busy ? Loader2 : on ? BellRing : BellOff;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={className}
            onClick={toggle}
            disabled={busy}
            aria-label={on ? "Turn off notifications" : "Turn on notifications"}
          >
            <Icon className={`h-5 w-5 ${busy ? "animate-spin" : on ? "text-primary" : ""}`} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {on ? "Notifications on for this device" : "Get alerts for new materials & deadlines"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Silent keep-in-sync: refreshes the stored device record on route/account changes. */
export function PushSync() {
  useEffect(() => {
    void syncPushSubscription();
  }, []);
  useEffect(() => {
    const onStorage = () => void syncPushSubscription();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
