import { AppSidebar } from '@/features/patients/components/AppSidebar';
import { NewPatientForm } from '@/features/patients/components/NewPatientForm';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function NewPatientPage(props: {
  params: Promise<{ locale: Locale }>;
}) {
  const params = await props.params;
  const dictionary = getDictionary(params.locale);

  return (
    <div className="flex min-h-0 flex-1">
      <AppSidebar locale={params.locale} dictionary={dictionary} />
      <div className="flex-1 overflow-auto px-10 py-10">
        <NewPatientForm locale={params.locale} dictionary={dictionary} />
      </div>
    </div>
  );
}
