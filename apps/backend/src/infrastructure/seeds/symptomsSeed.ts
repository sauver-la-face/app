// Référentiel des symptômes post-opératoires affichés sous forme de pictogrammes côté mobile.
// Le `code` fait le lien avec l'asset image dans apps/mobile/src/assets/symptoms/[code].png.
// Liste basique post-chirurgie maxillo-faciale — à valider et étendre avec les chirurgiens toulousains.
// Les traductions khmer sont indicatives et doivent être revues par un locuteur natif.

export type SymptomSeed = {
  code: string;
  label_fr: string;
  label_km: string;
  triggers_alert: boolean;
};

export const SYMPTOMS_SEED: readonly SymptomSeed[] = [
  {
    code: 'pain_mild',
    label_fr: 'Douleur légère',
    label_km: 'ឈឺបន្តិច',
    triggers_alert: false,
  },
  {
    code: 'pain_severe',
    label_fr: 'Douleur sévère',
    label_km: 'ឈឺខ្លាំង',
    triggers_alert: true,
  },
  {
    code: 'bleeding',
    label_fr: 'Saignement',
    label_km: 'ហូរឈាម',
    triggers_alert: true,
  },
  {
    code: 'fever',
    label_fr: 'Fièvre',
    label_km: 'គ្រុនក្ដៅ',
    triggers_alert: true,
  },
  {
    code: 'swelling',
    label_fr: 'Gonflement',
    label_km: 'ហើម',
    triggers_alert: false,
  },
  {
    code: 'pus',
    label_fr: 'Suppuration',
    label_km: 'ខ្ទុះ',
    triggers_alert: true,
  },
  {
    code: 'bad_smell',
    label_fr: 'Mauvaise odeur',
    label_km: 'ក្លិនមិនល្អ',
    triggers_alert: true,
  },
  {
    code: 'difficulty_eating',
    label_fr: 'Difficulté à manger',
    label_km: 'ពិបាកញ៉ាំ',
    triggers_alert: false,
  },
] as const;
