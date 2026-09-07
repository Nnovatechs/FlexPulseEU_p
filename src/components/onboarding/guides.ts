export type OnboardingSection = {
  title: string;
  body: string;
};

export type OnboardingGuideContent = {
  ariaLabel: string;
  title: string;
  intro: string;
  sections: OnboardingSection[];
};

export const workspaceOnboardingGuide: OnboardingGuideContent = {
  ariaLabel: "Open workspace guide",
  title: "Welcome to FlexPulse-EU",
  intro:
    "This is the main workspace for creating, organising and accessing your survey instruments.",
  sections: [
    {
      title: "Create and organise surveys",
      body: "Create a new survey to start a draft. The workspace lists draft and published instruments so you can return to their configuration, participant links and analytics. Archived surveys are hidden from this list but remain accessible from their survey page.",
    },
    {
      title: "Work from a draft",
      body: "Draft surveys can be configured, generated and reviewed. If you need to develop an alternative after publication, duplicate the survey and continue from the new draft.",
    },
    {
      title: "Publication status",
      body: "Publishing freezes the survey definition and its respondent-facing content. Published surveys can collect responses and be analysed, but their wording and measurement setup are no longer edited through the draft workflow.",
    },
    {
      title: "Where to go next",
      body: "Open a survey to review its status and participant links, use Edit to configure or develop a draft, and use Analytics to examine collected response data.",
    },
  ],
};

export const editorOnboardingGuide: OnboardingGuideContent = {
  ariaLabel: "Open survey editor guide",
  title: "How the survey editor works",
  intro:
    "Use this area to configure a draft, generate its candidate instrument, review the current version, and prepare it for publication.",
  sections: [
    {
      title: "Configure",
      body: "Start in Configuration. Set the survey languages and context, then select the behavioural concepts the instrument should cover.",
    },
    {
      title: "Generate and edit",
      body: "Save and generate creates a traceable candidate survey from the current configuration. In Questions, you can inspect and edit the generated wording before moving to review.",
    },
    {
      title: "Review the current version",
      body: "Review checks the current instrument against its declared structure and runs the available multilingual checks. These checks support quality control; they do not replace appropriate subject-matter, linguistic or stakeholder review.",
    },
    {
      title: "Preview and publish",
      body: "Preview lets you inspect the respondent-facing survey before launch. Publishing freezes the survey and its translations, so confirm that the current version is final. To make a later alternative, duplicate the survey and work from the new draft.",
    },
    {
      title: "Before the first publication",
      body: "Before launching a public survey, complete the account-level privacy and DPA settings required for your workspace. These settings are managed separately from the survey editor.",
    },
  ],
};

export const analyticsOnboardingGuide: OnboardingGuideContent = {
  ariaLabel: "Open analytics guide",
  title: "How to use Analytics",
  intro:
    "This dashboard reads the ready responses for this survey and organises them into four views: a survey-wide picture, a custom segment builder, a two-group comparison, and instrument diagnostics.",
  sections: [
    {
      title: "Overview",
      body: "Start here for the whole sample. You will see how many responses are in, date coverage, country mix, construct summaries, and the declared flexibility opportunity views. Use it to spot the main patterns before opening a narrower group.",
    },
    {
      title: "Segment Explorer",
      body: "Build a group from the fields available for this survey: profile scores and facets, household or applicability factors, assets, geography and context. Filters combine with AND. The live sample preview updates as you add conditions. When the group looks right, run the analysis to open the full segment reading, or send the definition to Compare.",
    },
    {
      title: "Compare",
      body: "From Segment Explorer, add up to two definitions to the comparison tray (A and B). Compare then ranks the largest score and composition differences between those two groups so you can see where they diverge most clearly.",
    },
    {
      title: "Instrument Health",
      body: "This view shows how the questionnaire itself is behaving: answer distributions, item-level signals, scoring coverage, and construct diagnostics. Use it when you want to check the instrument before leaning on a particular score.",
    },
    {
      title: "Working across the tabs",
      body: "Overview is the default wide lens. Segment Explorer is where you define and inspect a group. Compare only uses the two tray slots you filled there. Instrument Health stays about the questionnaire, not about a specific segment. Sample size and coverage stay visible in each view so you can judge how strong a reading is.",
    },
  ],
};
