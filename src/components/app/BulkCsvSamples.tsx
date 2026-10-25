import { Download, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/i18n";
import { downloadSampleWorkbook } from "@/lib/api/sample-workbook";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function BulkCsvSamples() {
  const { t } = useI18n();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline">
          <Download className="size-4" aria-hidden="true" />
          {t("humanBulk.downloadSample")}
          <ChevronDown className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onSelect={() =>
            downloadSampleWorkbook("bulk-sms-sample.xlsx", [
              ["recipient", "body"],
              ["+966500000001", "Example notification"],
            ])
          }
        >
          <Download className="size-4" aria-hidden="true" />
          {t("humanBulk.sample.sms")}
        </DropdownMenuItem>
        {(["email", "whatsapp"] as const).map((channel) => (
          <DropdownMenuItem key={channel} asChild>
            <a href={`/bulk-${channel}-sample.csv`} download>
              <Download className="size-4" aria-hidden="true" />
              {t(`humanBulk.sample.${channel}`)}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
