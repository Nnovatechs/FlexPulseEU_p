export type StakeholderType =
  | "Household"
  | "DSO"
  | "Retailer"
  | "Prosumer"
  | "Policy maker";

export type SurveyStatus = "Draft" | "Validated" | "Published";

export type SurveyConcept =
  | "Trusting Automation"
  | "Thermal Comfort Zones"
  | "Flexibility Necessities"
  | "Heat Pump Adoption"
  | "EV Charging Behaviour";

export type SurveyQuestion = {
  id: string;
  title: string;
  description: string;
  type: "single-choice" | "multi-choice" | "scale" | "open-text";
  required: boolean;
};

export type Survey = {
  id: string;
  title: string;
  stakeholderType: StakeholderType;
  sourceLanguage: string;
  targetLanguages: string[];
  ontologyConcepts: SurveyConcept[];
  status: SurveyStatus;
  updatedAt: string;
  responsesCount: number;
  questions: SurveyQuestion[];
};
