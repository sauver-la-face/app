import { PatientManagementPage } from '@/features/patients/components/PatientManagementPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default function PatientsPage({ params }: { params: { locale: Locale } }) {
  const dictionary = getDictionary(params.locale);

  return <PatientManagementPage locale={params.locale} dictionary={dictionary} />;
}
