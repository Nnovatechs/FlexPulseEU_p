import Image from "next/image";

type PublicSurveyVisibilityProps = {
  language?: string;
  compact?: boolean;
};

const VISIBILITY_COPY: Record<
  string,
  { acknowledgement: string; disclaimer: string }
> = {
  English: {
    acknowledgement:
      "This work was framed in the context of the project OCEI, which receives funding from the European Union's Horizon Europe research and innovation programme under grant agreement 101189589.",
    disclaimer:
      "Views and opinions expressed are, however, those of the author(s) only and do not necessarily reflect those of the European Union. Neither the European Union nor the granting authority can be held responsible for them.",
  },
  Spanish: {
    acknowledgement:
      "Este trabajo se enmarca en el contexto del proyecto OCEI, que recibe financiacion de la Union Europea a traves del programa de investigacion e innovacion Horizonte Europa, en virtud del acuerdo de subvencion 101189589.",
    disclaimer:
      "No obstante, los puntos de vista y opiniones expresados son exclusivamente los del autor o autores y no reflejan necesariamente los de la Union Europea. Ni la Union Europea ni la autoridad otorgante pueden ser consideradas responsables de ellos.",
  },
  French: {
    acknowledgement:
      "Ce travail s'inscrit dans le cadre du projet OCEI, qui recoit un financement de l'Union europeenne dans le cadre du programme de recherche et d'innovation Horizon Europe au titre de la convention de subvention 101189589.",
    disclaimer:
      "Les points de vue et opinions exprimes n'engagent toutefois que leur(s) auteur(s) et ne refletent pas necessairement ceux de l'Union europeenne. Ni l'Union europeenne ni l'autorite subventionnaire ne peuvent en etre tenues responsables.",
  },
  Croatian: {
    acknowledgement:
      "Ovaj je rad oblikovan u kontekstu projekta OCEI, koji prima financijska sredstva Europske unije iz programa za istrazivanje i inovacije Obzor Europa u okviru ugovora o dodjeli bespovratnih sredstava 101189589.",
    disclaimer:
      "Izneseni stavovi i misljenja ipak su iskljucivo stavovi autora i ne odrazavaju nuzno stavove Europske unije. Ni Europska unija ni tijelo koje dodjeljuje sredstva ne mogu se smatrati odgovornima za njih.",
  },
};

export function PublicSurveyVisibility({
  language = "English",
  compact = false,
}: PublicSurveyVisibilityProps) {
  const copy = VISIBILITY_COPY[language] ?? VISIBILITY_COPY.English;

  return (
    <section
      className={`sf-visibility${compact ? " sf-visibility--compact" : ""}`}
      aria-label="Project and funding information"
    >
      <div className="sf-visibility__logos">
        <div className="sf-visibility__logo-card sf-visibility__logo-card--eu">
          <Image
            src="/brand/eu-cofunded-pos-official.png"
            alt="Co-funded by the European Union"
            width={1024}
            height={229}
            className="sf-visibility__eu-image"
            priority={compact}
          />
        </div>
        <div className="sf-visibility__logo-card sf-visibility__logo-card--ocei">
          <Image
            src="/brand/ocei-horizontal-pos.png"
            alt="O-CEI project logo"
            width={314}
            height={91}
            className="sf-visibility__ocei-image"
          />
        </div>
      </div>

      {!compact ? (
        <div className="sf-visibility__body">
          <p className="sf-visibility__statement">{copy.acknowledgement}</p>
          <p className="sf-visibility__disclaimer">{copy.disclaimer}</p>
        </div>
      ) : null}
    </section>
  );
}
