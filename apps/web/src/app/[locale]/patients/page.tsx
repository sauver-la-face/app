import { PatientManagementPage } from '@/features/patients/components/PatientManagementPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function PatientsPage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const dictionary = getDictionary(params.locale);

  return <PatientManagementPage locale={params.locale} dictionary={dictionary} />;
}
