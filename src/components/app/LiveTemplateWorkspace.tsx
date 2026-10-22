import { useState } from "react";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { TemplateRegistry } from "./TemplateRegistry";
import { ContentTemplateRegistry } from "./ContentTemplateRegistry";
export function LiveTemplateWorkspace() {
  const { t } = useI18n();
  const [content, setContent] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2 px-6 pt-4">
        <Button variant={content ? "outline" : "default"} onClick={() => setContent(false)}>
          {t("content.whatsapp")}
        </Button>
        <Button variant={content ? "default" : "outline"} onClick={() => setContent(true)}>
          {t("content.title")}
        </Button>
      </div>
      {content ? <ContentTemplateRegistry /> : <TemplateRegistry />}
    </>
  );
}
