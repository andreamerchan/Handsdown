// Site-wide navigation. Edit here to change the header and footer links everywhere.

export const mainNav = [
  { id: "home", label: "Home", href: "/" },
  { id: "hire", label: "Hire Talent", href: "/hire" },
  { id: "how-it-works", label: "How it Works", href: "/how-it-works" },
  { id: "pricing", label: "Pricing", href: "/pricing" },
] as const;

export type NavId = (typeof mainNav)[number]["id"];

export const footerColumns = [
  {
    title: "Hire",
    links: [
      {
        label: "Engineering",
        href: "/hire/engineering",
      },
      {
        label: "AI & Data",
        href: "/hire/ai-data",
      },
      {
        label: "Data & Analytics",
        href: "/hire/data-analytics",
      },
      {
        label: "Design",
        href: "/hire/design",
      },
      {
        label: "Product",
        href: "/hire/product",
      },
    ],
  },
  {
    title: "Company",
    links: [
      {
        label: "Why Handsdown",
        href: "/",
      },
      {
        label: "How it Works",
        href: "/how-it-works",
      },
      {
        label: "Pricing",
        href: "/pricing",
      },
    ],
  },
  {
    title: "Specialists",
    links: [
      {
        label: "Apply as an engineer",
        href: "/apply",
      },
    ],
  },
  {
    title: "Legal",
    links: [
      {
        label: "Privacy",
        href: "/legal/privacy",
      },
    ],
  },
];
