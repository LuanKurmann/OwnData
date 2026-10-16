import type { Jurisdiction, RequestType } from "@/db/schema";

export type LegalInfo = {
  /** statutory response deadline in days */
  deadlineDays: Record<RequestType, number>;
  /** days after the deadline we wait after a reminder before offering escalation */
  escalationGraceDays: number;
  authority: {
    name: Record<"de" | "en", string>;
    url: string;
    email?: string;
    address?: string;
    note: Record<"de" | "en", string>;
  };
};

export const LEGAL: Record<Jurisdiction, LegalInfo> = {
  gdpr: {
    deadlineDays: { erasure: 30, access: 30, optout: 30 },
    escalationGraceDays: 14,
    authority: {
      name: {
        de: "Zuständige Datenschutz-Aufsichtsbehörde (EU/EWR)",
        en: "Competent data protection supervisory authority (EU/EEA)",
      },
      url: "https://www.edpb.europa.eu/about-edpb/about-edpb/members_en",
      note: {
        de: "Zuständig ist die Behörde deines Wohnsitzlandes oder die des Unternehmenssitzes. Für Deutschland: Landesbeauftragte des Bundeslandes, in dem das Unternehmen sitzt; für Österreich: Datenschutzbehörde (dsb.gv.at); Irland: DPC; Frankreich: CNIL.",
        en: "You may complain to the authority of your country of residence or the one where the company is established. Germany: state authority of the company's seat; Austria: DSB (dsb.gv.at); Ireland: DPC; France: CNIL.",
      },
    },
  },
  dsg: {
    deadlineDays: { erasure: 30, access: 30, optout: 30 },
    escalationGraceDays: 14,
    authority: {
      name: {
        de: "Eidgenössischer Datenschutz- und Öffentlichkeitsbeauftragter (EDÖB)",
        en: "Federal Data Protection and Information Commissioner (FDPIC)",
      },
      url: "https://www.edoeb.admin.ch",
      address: "EDÖB, Feldeggweg 1, 3003 Bern, Schweiz",
      note: {
        de: "Der EDÖB nimmt Meldungen zu Verstößen entgegen (Art. 49 DSG). Zivilrechtliche Ansprüche (Löschung, Auskunft) setzt du beim Zivilgericht an deinem Wohnsitz durch (Art. 32 Abs. 2 DSG, kostenloses Verfahren nach Art. 114 ZPO).",
        en: "The FDPIC accepts reports of violations (Art. 49 FADP). Civil claims (erasure, access) are enforced before the civil court at your domicile (Art. 32 para. 2 FADP; proceedings are free of court costs under Art. 114 CPC).",
      },
    },
  },
  ccpa: {
    deadlineDays: { erasure: 45, access: 45, optout: 15 },
    escalationGraceDays: 14,
    authority: {
      name: {
        de: "California Privacy Protection Agency (CPPA)",
        en: "California Privacy Protection Agency (CPPA)",
      },
      url: "https://cppa.ca.gov/webapplications/complaint",
      note: {
        de: "Beschwerde online bei der CPPA oder beim California Attorney General (oag.ca.gov/privacy/ccpa). CCPA-Rechte gelten formal für Einwohner Kaliforniens; viele US-Broker bearbeiten Löschanfragen aber weltweit.",
        en: "File online with the CPPA or the California Attorney General (oag.ca.gov/privacy/ccpa). CCPA rights formally apply to California residents, but many US brokers honour deletion requests from anyone.",
      },
    },
  },
};

export function deadlineDays(j: Jurisdiction, t: RequestType): number {
  return LEGAL[j].deadlineDays[t];
}

export const JURISDICTION_LABEL: Record<Jurisdiction, string> = {
  gdpr: "EU DSGVO / GDPR",
  dsg: "CH DSG / FADP",
  ccpa: "US CCPA / CPRA",
};
