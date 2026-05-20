import { notFound } from 'next/navigation';
import { DashboardPage } from '@/features/dashboard/components/DashboardPage';
import { isLocale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default function DashboardRoute({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) {
    notFound();
  }

  const dictionary = getDictionary(params.locale);

  return <DashboardPage locale={params.locale} dictionary={dictionary} />;
}
