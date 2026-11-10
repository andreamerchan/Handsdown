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

// "Hire Talent" menu (header dropdown and mobile menu). `count` is the number shown next to a group.
export const hireMenu: {
  name: string;
  href: string;
  count?: number;
  roles: { name: string; href: string }[];
}[] = [
  {
    name: "Engineering",
    href: "/hire/engineering",
    count: 452,
    roles: [
      {
        name: "Frontend Engineer",
        href: "/hire/engineering/frontend-engineer",
      },
      {
        name: "Backend Engineer",
        href: "/hire/engineering/backend-engineer",
      },
      {
        name: "Full-Stack Engineer",
        href: "/hire/engineering/fullstack-engineer",
      },
      {
        name: "Mobile Engineer",
        href: "/hire/engineering/mobile-engineer",
      },
      {
        name: "QA Automation Engineer",
        href: "/hire/engineering/qa-engineer",
      },
      {
        name: "DevOps & Cloud Engineer",
        href: "/hire/engineering/devops-engineer",
      },
      {
        name: "AI & Data Engineer",
        href: "/hire/engineering/ai-data-engineer",
      },
    ],
  },
  {
    name: "AI & Data",
    href: "/hire/ai-data",
    count: 138,
    roles: [
      {
        name: "AI/ML Engineer",
        href: "/hire/ai-data/ai-engineer",
      },
      {
        name: "Applied AI & LLM Engineer",
        href: "/hire/ai-data/applied-ai-engineer",
      },
      {
        name: "Data Scientist",
        href: "/hire/ai-data/data-scientist",
      },
      {
        name: "MLOps Engineer",
        href: "/hire/ai-data/mlops-engineer",
      },
      {
        name: "Data Analyst",
        href: "/hire/ai-data/data-analyst",
      },
    ],
  },
  {
    name: "Data & Analytics",
    href: "/hire/data-analytics",
    count: 88,
    roles: [
      {
        name: "Data Engineer",
        href: "/hire/data-analytics/data-engineer",
      },
      {
        name: "Analytics Engineer",
        href: "/hire/data-analytics/analytics-engineer",
      },
      {
        name: "BI & Visualization Developer",
        href: "/hire/data-analytics/bi-visualization-developer",
      },
      {
        name: "Warehousing Engineer",
        href: "/hire/data-analytics/warehousing-engineer",
      },
      {
        name: "ML / Forecasting Engineer",
        href: "/hire/data-analytics/ml-forecasting-engineer",
      },
    ],
  },
  {
    name: "Design",
    href: "/hire/design",
    count: 96,
    roles: [
      {
        name: "Product Designer",
        href: "/hire/design/product-designer",
      },
      {
        name: "Design Systems Designer",
        href: "/hire/design/design-systems-designer",
      },
      {
        name: "UX Designer",
        href: "/hire/design/ux-designer",
      },
      {
        name: "Interaction Designer",
        href: "/hire/design/interaction-designer",
      },
      {
        name: "UI & Visual Designer",
        href: "/hire/design/ui-visual-designer",
      },
      {
        name: "User Researcher",
        href: "/hire/design/user-researcher",
      },
      {
        name: "Prototyper",
        href: "/hire/design/prototyper",
      },
    ],
  },
  {
    name: "Product",
    href: "/hire/product",
    roles: [
      {
        name: "Product Manager",
        href: "/hire/product",
      },
    ],
  },
];

// Where "Describe your role" prompts and the header button send visitors.
// The original site sends them to its Smart Match app (/match), which needs a backend.
export const promptDestination = "/book";

// Endpoint that receives the /book form (POST, multipart form data). Leave empty until
// you have one (your own API, Formspree, Netlify Forms, ...): the form then explains
// that it is not connected instead of pretending to send.
export const bookFormEndpoint = "";

// Where "Apply as Talent" should take people once the application flow exists.
export const applyDestination = "";
