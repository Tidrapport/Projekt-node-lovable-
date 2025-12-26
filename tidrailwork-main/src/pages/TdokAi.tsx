import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/api/client";

const TdokAi = () => {
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<
    { role: "user" | "assistant"; content: string; sources?: string[] }[]
  >([]);
  const aiEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!aiMessages.length) return;
    aiEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [aiMessages]);

  const sendAi = async () => {
    const content = aiInput.trim();
    if (!content || aiLoading) return;

    const nextMessages = [...aiMessages, { role: "user", content }];
    setAiMessages(nextMessages);
    setAiInput("");
    setAiLoading(true);

    try {
      const res = await apiFetch<{ reply?: string; sources?: string[] }>("/help/ai", {
        method: "POST",
        json: { question: content },
      });
      const reply = String(res?.reply || "").trim() || "Inget svar från AI.";
      const sources = Array.isArray(res?.sources) ? res.sources : [];
      setAiMessages([...nextMessages, { role: "assistant", content: reply, sources }]);
    } catch (err: any) {
      setAiMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "Kunde inte nå AI-tjänsten. Försök igen senare.",
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-3xl font-bold font-heading">TDOK AI</h2>
        <p className="text-muted-foreground">
          Arbetshjälp baserad på lokala TDOK/TRVinfra-dokument.
        </p>
      </div>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Arbetshjälp (AI)</CardTitle>
          <CardDescription>
            Fråga om TDOK/TRVinfra. AI:n svarar bara utifrån lokala dokument.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-56 rounded-md border bg-muted/30">
            <div className="space-y-3 p-3">
              {aiMessages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Ingen historik ännu. Ställ en fråga så hjälper vi till.
                </p>
              )}
              {aiMessages.map((message, index) => (
                <div key={`${message.role}-${index}`} className="rounded-md bg-background p-3 shadow-sm">
                  <p className="text-xs uppercase text-muted-foreground">
                    {message.role === "user" ? "Du" : "AI"}
                  </p>
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                  {message.role === "assistant" && message.sources && message.sources.length > 0 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Källor: {message.sources.join(", ")}
                    </p>
                  )}
                </div>
              ))}
              <div ref={aiEndRef} />
            </div>
          </ScrollArea>

          <div className="space-y-2">
            <Label>Fråga</Label>
            <Textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              placeholder="Ex: Hur beräknar jag ett A-skydd?"
              rows={4}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Dela inte känsliga uppgifter. AI:n kan sakna svar om dokument saknas.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setAiMessages([])}
                disabled={aiLoading || aiMessages.length === 0}
              >
                Rensa
              </Button>
              <Button onClick={sendAi} disabled={aiLoading || !aiInput.trim()}>
                {aiLoading ? "Analyserar..." : "Skicka"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TdokAi;
