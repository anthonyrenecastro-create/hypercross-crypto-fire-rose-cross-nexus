import React, { useState } from "react";
import { CreditCard, CircleDollarSign, ArrowLeft, Shield, CheckCircle2, Loader2, Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type PlanTier = "starter" | "pro" | "enterprise";

const PLAN_DETAILS: Record<
  PlanTier,
  { name: string; price: string; priceNote: string; color: string; features: string[] }
> = {
  starter: {
    name: "Starter",
    price: "$29.99",
    priceNote: "per month",
    color: "#0ea5e9",
    features: [
      "2 workspaces",
      "Core asset modules",
      "PayPal payments",
      "Email support",
    ],
  },
  pro: {
    name: "Pro",
    price: "$299",
    priceNote: "per month",
    color: "#f97316",
    features: [
      "10 workspaces",
      "Derivatives + copy trading",
      "Stripe & PayPal payments",
      "Priority support",
    ],
  },
  enterprise: {
    name: "Enterprise",
    price: "Custom",
    priceNote: "contact sales",
    color: "#c300ff",
    features: [
      "Unlimited workspaces",
      "All payment rails incl. bank link",
      "SLA + dedicated onboarding",
      "White-label deployment",
    ],
  },
};

interface CheckoutPageProps {
  plan: PlanTier;
  email: string;
  onBack: () => void;
  onSuccess: (plan: PlanTier) => void;
}

export default function CheckoutPage({ plan, email, onBack, onSuccess }: CheckoutPageProps) {
  const [provider, setProvider] = useState<"stripe" | "paypal">("stripe");
  const [contactName, setContactName] = useState("");
  const [contactMessage, setContactMessage] = useState("");
  const [contactSent, setContactSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const planDef = PLAN_DETAILS[plan];
  const isProOrStarter = plan === "starter" || plan === "pro";
  const allowedProviders = plan === "starter" ? ["paypal"] : ["stripe", "paypal"];

  const handleCheckout = async () => {
    if (!isProOrStarter) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, plan, email }),
      });
      const data = await res.json().catch(() => ({})) as any;
      if (!res.ok) {
        setError(data?.error || `Failed to create ${provider} checkout session.`);
        return;
      }
      // Redirect to payment provider (Stripe hosted checkout or PayPal approval)
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("No redirect URL returned from payment provider.");
      }
    } catch (err: any) {
      setError(err?.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEnterpriseSend = () => {
    // In production, POST to /api/contact-sales
    setContactSent(true);
  };

  if (plan === "enterprise") {
    return (
      <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-40 -left-28 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle,rgba(195,0,255,0.18)_0%,transparent_65%)]" />
          <div className="absolute -bottom-40 -right-28 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(21,0,255,0.14)_0%,transparent_65%)]" />
        </div>
        <div className="relative z-10 w-full max-w-lg">
          <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to plans
          </button>
          {!contactSent ? (
            <Card className="bg-black/60 border border-white/10 backdrop-blur-xl">
              <CardHeader>
                <div className="h-1 w-16 rounded-full mb-4" style={{ background: `linear-gradient(to right, ${planDef.color}, #7e22ce)` }} />
                <CardTitle className="text-white text-2xl">Contact Sales</CardTitle>
                <CardDescription className="text-white/55">
                  Tell us about your use case and we'll tailor an Enterprise engagement.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-white/70">Your name</Label>
                  <Input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Jane Smith"
                    className="mt-1 bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div>
                  <Label className="text-white/70">Email</Label>
                  <Input
                    value={email}
                    readOnly
                    className="mt-1 bg-white/5 border-white/10 text-white/60 cursor-not-allowed"
                  />
                </div>
                <div>
                  <Label className="text-white/70">Tell us about your needs</Label>
                  <textarea
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    rows={4}
                    placeholder="We're looking to deploy cross-chain custody for..."
                    className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-white px-3 py-2 text-sm placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-[#c300ff]"
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  style={{ background: "linear-gradient(to right, #c300ff, #7e22ce)" }}
                  onClick={handleEnterpriseSend}
                  disabled={!contactName.trim() || !contactMessage.trim()}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send to Sales Team
                </Button>
              </CardFooter>
            </Card>
          ) : (
            <Card className="bg-black/60 border border-white/10 backdrop-blur-xl text-center">
              <CardContent className="pt-10 pb-10 space-y-4">
                <CheckCircle2 className="h-14 w-14 text-green-400 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Message Received</h2>
                <p className="text-white/55 text-sm">Our enterprise team will reach out to {email} within 1 business day.</p>
                <Button variant="outline" className="border-white/20 text-white/70 mt-4" onClick={onBack}>
                  Back to plans
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center p-6">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-28 h-[520px] w-[520px] rounded-full bg-[radial-gradient(circle,rgba(14,165,233,0.18)_0%,transparent_65%)]" />
        <div className="absolute -bottom-40 -right-28 h-[400px] w-[400px] rounded-full bg-[radial-gradient(circle,rgba(195,0,255,0.14)_0%,transparent_65%)]" />
      </div>

      <div className="relative z-10 w-full max-w-4xl">
        <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back to plans
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: Order Summary */}
          <div className="lg:col-span-2">
            <Card className="bg-black/60 border border-white/10 backdrop-blur-xl h-full">
              <CardContent className="pt-6 space-y-6">
                <div>
                  <div className="h-1 w-12 rounded-full mb-4" style={{ background: `linear-gradient(to right, ${planDef.color}, #7e22ce)` }} />
                  <p className="text-white/45 text-xs uppercase tracking-widest mb-1">Selected Plan</p>
                  <h2 className="text-2xl font-bold text-white">{planDef.name}</h2>
                  <p className="text-3xl font-bold mt-2 text-white">
                    {planDef.price}
                    <span className="text-sm text-white/45 font-normal ml-1">{planDef.priceNote}</span>
                  </p>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-4">
                  {planDef.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm text-white/70">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-400 flex-shrink-0" />
                      {f}
                    </div>
                  ))}
                </div>

                <div className="border-t border-white/10 pt-4 space-y-1">
                  <div className="flex justify-between text-sm text-white/50">
                    <span>Subtotal</span>
                    <span>{planDef.price}/mo</span>
                  </div>
                  <div className="flex justify-between text-sm text-white/50">
                    <span>Billed</span>
                    <span>Monthly</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold text-white border-t border-white/10 pt-2 mt-2">
                    <span>Total due today</span>
                    <span>{planDef.price}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs text-white/35 mt-2">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Payments secured via Stripe or PayPal. Cancel anytime.</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Payment selection */}
          <div className="lg:col-span-3 space-y-4">
            <Card className="bg-black/60 border border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-white text-lg">Payment Method</CardTitle>
                <CardDescription className="text-white/50">
                  Choose how you'd like to pay. You'll be redirected to complete the payment securely.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stripe option */}
                {allowedProviders.includes("stripe") && (
                  <button
                    onClick={() => setProvider("stripe")}
                    className={`w-full flex items-start gap-4 rounded-xl border p-4 transition-all text-left ${
                      provider === "stripe"
                        ? "border-[#635bff] bg-[#635bff]/10"
                        : "border-white/10 bg-white/5 hover:border-white/20"
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${provider === "stripe" ? "border-[#635bff]" : "border-white/30"}`}>
                      {provider === "stripe" && <div className="h-2 w-2 rounded-full bg-[#635bff]" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4 text-[#635bff]" />
                        <span className="font-semibold text-white text-sm">Stripe</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-[#635bff]/20 text-[#a89cff] border-0">Credit / Debit Card</Badge>
                      </div>
                      <p className="text-xs text-white/45">Visa, Mastercard, Amex, and more. Powered by Stripe Checkout.</p>
                    </div>
                  </button>
                )}

                {/* Starter: Stripe not available */}
                {!allowedProviders.includes("stripe") && (
                  <div className="w-full flex items-start gap-4 rounded-xl border border-white/5 bg-white/3 p-4 opacity-50 cursor-not-allowed">
                    <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-white/20 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CreditCard className="h-4 w-4 text-white/30" />
                        <span className="font-semibold text-white/30 text-sm">Stripe</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-yellow-500/20 text-yellow-400 border-0">Pro+ Only</Badge>
                      </div>
                      <p className="text-xs text-white/30">Upgrade to Pro to enable Stripe card payments.</p>
                    </div>
                  </div>
                )}

                {/* PayPal option */}
                <button
                  onClick={() => setProvider("paypal")}
                  className={`w-full flex items-start gap-4 rounded-xl border p-4 transition-all text-left ${
                    provider === "paypal"
                      ? "border-[#0070ba] bg-[#0070ba]/10"
                      : "border-white/10 bg-white/5 hover:border-white/20"
                  }`}
                >
                  <div className={`mt-0.5 h-4 w-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${provider === "paypal" ? "border-[#0070ba]" : "border-white/30"}`}>
                    {provider === "paypal" && <div className="h-2 w-2 rounded-full bg-[#0070ba]" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <CircleDollarSign className="h-4 w-4 text-[#0070ba]" />
                      <span className="font-semibold text-white text-sm">PayPal</span>
                      <Badge className="text-[10px] px-1.5 py-0 bg-[#0070ba]/20 text-[#5ebfff] border-0">PayPal Balance / Bank</Badge>
                    </div>
                    <p className="text-xs text-white/45">Pay with your PayPal account, balance, or linked bank.</p>
                  </div>
                </button>

                {error && (
                  <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                    {error}
                  </div>
                )}
              </CardContent>
              <CardFooter className="flex-col gap-3">
                <Button
                  className="w-full h-12 text-base font-semibold"
                  style={
                    provider === "stripe"
                      ? { background: "linear-gradient(135deg, #635bff, #4f46e5)" }
                      : { background: "linear-gradient(135deg, #0070ba, #005c99)" }
                  }
                  disabled={loading}
                  onClick={handleCheckout}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Redirecting…
                    </>
                  ) : provider === "stripe" ? (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Pay with Stripe →
                    </>
                  ) : (
                    <>
                      <CircleDollarSign className="h-4 w-4 mr-2" />
                      Pay with PayPal →
                    </>
                  )}
                </Button>
                <p className="text-xs text-white/30 text-center">
                  You'll be redirected to {provider === "stripe" ? "Stripe's secure checkout" : "PayPal"} to complete payment.
                  After payment, you'll be brought back to your dashboard.
                </p>
              </CardFooter>
            </Card>

            {/* Billing email notice */}
            <div className="flex items-center gap-2 px-1">
              <Mail className="h-3.5 w-3.5 text-white/30" />
              <p className="text-xs text-white/35">Receipt will be sent to <span className="text-white/55">{email}</span></p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
