import { surveyLanguageOptions } from "@/features/surveys/language-options";

type SurveyLanguageSelectProps = {
  defaultValue: string;
};

export function SurveyLanguageSelect({ defaultValue }: SurveyLanguageSelectProps) {
  return (
    <select name="defaultLanguage" defaultValue={defaultValue} required>
      {surveyLanguageOptions.map((language) => (
        <option key={language} value={language}>
          {language}
        </option>
      ))}
    </select>
  );
}
