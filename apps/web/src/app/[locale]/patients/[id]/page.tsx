import { PatientHistoryPage } from '@/features/patients/components/PatientHistoryPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function PatientPage(props: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const params = await props.params;
  const dictionary = getDictionary(params.locale);

  return (
    <PatientHistoryPage locale={params.locale} patientId={params.id} dictionary={dictionary} />
  );
}
