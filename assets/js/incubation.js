import { supabase } from "./main.js"; // Re-use the client initialized in main.js

const projectsGrid = document.getElementById("projects-grid");
const incubationGrid = document.getElementById("incubation-grid");

// Status badge color mapping
const statusColors = {
  idea: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  mvp: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  production: "bg-green-500/10 text-green-400 border-green-500/20",
  archived: "bg-gray-500/10 text-gray-400 border-gray-500/20"
};

async function fetchAndRenderProjects() {
  try {
    // Fetch only public projects, ordered by newest first
    const { data: projects, error } = await supabase
      .from("projects")
      .select("id, title, description, status, link, created_at")
      .eq("is_public", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Supabase fetch error:", error);
      projectsGrid.innerHTML = `<p class="text-red-400 col-span-full text-center">Failed to load projects.</p>`;
      return;
    }

    if (!projects || projects.length === 0) {
      projectsGrid.innerHTML = `<p class="text-[var(--text-secondary)] col-span-full text-center">No projects published yet. Check back soon!</p>`;
      if (incubationGrid) incubationGrid.innerHTML = `<p class="text-[var(--text-secondary)] col-span-full text-center">No active incubation ideas.</p>`;
      return;
    }

    // Render Main Projects Grid
    projectsGrid.innerHTML = projects.map(project => `
      <article class="group p-6 rounded-2xl bg-[var(--bg-card)] border border-white/5 hover:border-[var(--accent)]/30 transition-all duration-300">
        <div class="flex items-center justify-between mb-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-medium border ${statusColors[project.status] || statusColors.idea} uppercase tracking-wider">
            ${project.status}
          </span>
          <span class="text-xs text-[var(--text-secondary)]">${new Date(project.created_at).toLocaleDateString()}</span>
        </div>
        <h3 class="text-xl font-bold mb-2 group-hover:text-[var(--accent)] transition-colors">${project.title}</h3>
        <p class="text-sm text-[var(--text-secondary)] mb-4 line-clamp-3">${project.description}</p>
        ${project.link ? `<a href="${project.link}" target="_blank" rel="noopener" class="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:underline">
          View Project <i data-lucide="arrow-up-right" class="w-4 h-4"></i>
        </a>` : ''}
      </article>
    `).join("");

    // Render Incubation Grid (Filter for idea/mvp only)
    if (incubationGrid) {
      const incubationProjects = projects.filter(p => p.status === 'idea' || p.status === 'mvp');
      incubationGrid.innerHTML = incubationProjects.map(project => `
        <div class="p-4 rounded-xl bg-[var(--bg-primary)] border border-white/5 hover:border-[var(--accent)]/20 transition-all">
          <div class="flex items-center gap-2 mb-2">
            <span class="w-2 h-2 rounded-full ${project.status === 'mvp' ? 'bg-blue-400' : 'bg-yellow-400'}"></span>
            <span class="text-xs font-medium text-[var(--text-secondary)] uppercase">${project.status}</span>
          </div>
          <h4 class="font-semibold text-sm mb-1">${project.title}</h4>
          <p class="text-xs text-[var(--text-secondary)] line-clamp-2">${project.description}</p>
        </div>
      `).join("");
    }

    // Re-initialize Lucide icons for the newly injected HTML
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
      lucide.createIcons();
    }

  } catch (err) {
    console.error("Unexpected error rendering projects:", err);
  }
}

// Initialize on load
fetchAndRenderProjects();
