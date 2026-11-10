// Loads the role and category content from the JSON files in this folder.
// Add a role: create src/data/roles/<category>/<role>.json. The page appears at /hire/<category>/<role>.

const roleFiles = import.meta.glob("./roles/*/*.json", {
  eager: true,
  import: "default",
});
const categoryFiles = import.meta.glob("./categories/*.json", {
  eager: true,
  import: "default",
});

export const roles = Object.entries(roleFiles).map(([file, data]) => {
  const [, category, slug] = file.match(/roles\/([^/]+)\/([^/]+)\.json$/)!;
  return { category, slug, ...(data as Record<string, any>) };
});

export const categories = Object.entries(categoryFiles).map(([file, data]) => {
  const [, slug] = file.match(/categories\/([^/]+)\.json$/)!;
  return { slug, ...(data as Record<string, any>) };
});
