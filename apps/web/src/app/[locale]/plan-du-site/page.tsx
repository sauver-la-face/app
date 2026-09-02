import Link from 'next/link';
import { LegalPage, LegalSection } from '@/features/legal/components/LegalPage';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/dictionaries';

export default async function PlanDuSitePage(props: { params: Promise<{ locale: Locale }> }) {
  const params = await props.params;
  const { legal } = getDictionary(params.locale);
  const page = legal.sitemap;

  // Les écrans réellement servis par l'application, pas une arborescence
  // souhaitée : une page qui annonce des pages inexistantes reproduirait le
  // défaut que ces trois pages corrigent.
  const sections = [
    {
      title: page.accessTitle,
      links: [
        { href: `/${params.locale}`, label: page.linkHome },
        { href: `/${params.locale}/login`, label: page.linkLogin },
        { href: `/${params.locale}/register`, label: page.linkRegister },
        { href: `/${params.locale}/mfa/setup`, label: page.linkMfaSetup },
      ],
    },
    {
      title: page.careTitle,
      links: [
        { href: `/${params.locale}/dashboard`, label: page.linkDashboard },
        { href: `/${params.locale}/patients`, label: page.linkPatients },
        { href: `/${params.locale}/patients/new`, label: page.linkNewPatient },
      ],
    },
    {
      title: page.legalTitle,
      links: [
        { href: `/${params.locale}/mentions-legales`, label: page.linkNotices },
        { href: `/${params.locale}/confidentialite`, label: page.linkPrivacy },
        { href: `/${params.locale}/plan-du-site`, label: page.linkSitemap },
      ],
    },
  ];

  return (
    <LegalPage title={page.title} intro={page.intro} updatedAt={legal.updatedAt}>
      {sections.map((section) => (
        <LegalSection key={section.title} title={section.title}>
          <ul className="space-y-2">
            {section.links.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="underline hover:text-gray-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </LegalSection>
      ))}

      <LegalSection title={page.restrictedTitle}>
        <p>{page.restrictedBody}</p>
      </LegalSection>
    </LegalPage>
  );
}
