/**
 * WENG Official Website Runtime
 * Optimized for performance, memory allocation, accessibility, and fault isolation.
 */

// Module-level Intl date formatter (avoids recreating per iteration)
const showDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

// DOM Elements
const siteNav = document.querySelector(".site-nav")
const navMenuToggle = document.querySelector(".nav-menu-toggle")
const primaryNavigation = document.querySelector("#primary-navigation")
const showTabs = Array.from(
  document.querySelectorAll('[role="tab"][data-show-view], button[data-show-view]'),
)
const showPanels = document.querySelectorAll("[data-show-panel]")

/* ==========================================================================
   Mobile Navigation State Machine
   ========================================================================== */

function closeMobileNavigation() {
  if (!siteNav?.classList.contains("is-open")) return
  siteNav.classList.remove("is-open")
  document.body.classList.remove("nav-is-open")
  navMenuToggle?.setAttribute("aria-expanded", "false")
  navMenuToggle?.setAttribute("aria-label", "Open navigation")
  navMenuToggle?.focus()
}

function openMobileNavigation() {
  siteNav?.classList.add("is-open")
  document.body.classList.add("nav-is-open")
  navMenuToggle?.setAttribute("aria-expanded", "true")
  navMenuToggle?.setAttribute("aria-label", "Close navigation")
}

navMenuToggle?.addEventListener("click", () => {
  const isExpanded = navMenuToggle.getAttribute("aria-expanded") === "true"
  if (isExpanded) {
    closeMobileNavigation()
  } else {
    openMobileNavigation()
  }
})

// Close nav when clicking any nav link
primaryNavigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMobileNavigation)
})

// Trap Escape key to close navigation
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteNav?.classList.contains("is-open")) {
    closeMobileNavigation()
  }
})

// Handle viewport resize across mobile breakpoint
window.matchMedia("(min-width: 881px)").addEventListener("change", (event) => {
  if (event.matches) {
    closeMobileNavigation()
  }
})

/* ==========================================================================
   Accessible Tabs Component (APG Pattern)
   ========================================================================== */

function switchShowTab(targetTab) {
  const activeView = targetTab.dataset.showView
  if (!activeView) return

  showTabs.forEach((tab) => {
    const isSelected = tab === targetTab
    tab.setAttribute("aria-selected", String(isSelected))
    tab.setAttribute("aria-pressed", String(isSelected))
    tab.setAttribute("tabindex", isSelected ? "0" : "-1")
  })

  showPanels.forEach((panel) => {
    panel.hidden = panel.dataset.showPanel !== activeView
  })
}

showTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => switchShowTab(tab))

  // Keyboard navigation across tabs: Left, Right, Home, End
  tab.addEventListener("keydown", (event) => {
    let newIndex = index
    if (event.key === "ArrowRight") {
      newIndex = (index + 1) % showTabs.length
    } else if (event.key === "ArrowLeft") {
      newIndex = (index - 1 + showTabs.length) % showTabs.length
    } else if (event.key === "Home") {
      newIndex = 0
    } else if (event.key === "End") {
      newIndex = showTabs.length - 1
    } else {
      return
    }

    event.preventDefault()
    showTabs[newIndex].focus()
    switchShowTab(showTabs[newIndex])
  })
})

/* ==========================================================================
   Data Fetching with Robust Fault Isolation
   ========================================================================== */

async function loadPastShows(container) {
  const source = "data/all-shows.json"
  try {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${source}`)
    }

    const shows = await response.json()
    if (!Array.isArray(shows)) {
      throw new Error(`${source} is not an array`)
    }

    // Fault-tolerant parsing: filter and process without crashing on single bad row
    const visibleShows = []
    for (const show of shows) {
      if (!show?.display || !show.title || !show.location || !show["full-date"]) {
        continue
      }
      const parsedDate = new Date(show["full-date"])
      if (Number.isNaN(parsedDate.getTime())) {
        console.warn(`[show-data] Skipping invalid date: "${show["full-date"]}" for "${show.title}"`)
        continue
      }
      visibleShows.push({ ...show, parsedDate })
    }

    visibleShows.sort((a, b) => b.parsedDate - a.parsedDate)

    if (visibleShows.length === 0) {
      const emptyMsg = document.createElement("p")
      emptyMsg.className = "show-list-status"
      emptyMsg.textContent = "No past shows currently listed."
      container.replaceChildren(emptyMsg)
      return
    }

    const fragment = document.createDocumentFragment()
    for (const show of visibleShows) {
      const row = document.createElement("article")
      row.className = "show-row"

      const date = document.createElement("time")
      date.className = "show-date"
      date.dateTime = show.parsedDate.toISOString().slice(0, 10)
      date.textContent = showDateFormatter.format(show.parsedDate).toLowerCase()

      const location = document.createElement("p")
      location.className = "show-location"
      location.textContent = show.location.toLowerCase()

      const title = document.createElement("p")
      title.className = "show-title"
      title.textContent = show.title

      row.append(date, location, title)
      fragment.append(row)
    }

    container.replaceChildren(fragment)
  } catch (error) {
    console.error(`Error loading ${source}:`, error)
    const status = document.createElement("p")
    status.className = "show-list-status"
    status.textContent = "All shows are currently unavailable."
    container.replaceChildren(status)
  }
}

async function loadLiveSets(container) {
  const source = "data/live-sets.json"
  try {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} loading ${source}`)
    }

    const liveSets = await response.json()
    if (!Array.isArray(liveSets) || liveSets.length === 0) {
      throw new Error(`${source} is empty or invalid`)
    }

    const fragment = document.createDocumentFragment()
    for (const liveSet of liveSets) {
      if (!liveSet.title || !liveSet.image || !liveSet.youtube) continue

      const card = document.createElement("a")
      card.className = "live-set-card"
      card.href = liveSet.youtube
      card.target = "_blank"
      card.rel = "noopener noreferrer"
      card.setAttribute("aria-label", `${liveSet.title} on YouTube`)

      const image = document.createElement("img")
      image.className = "live-set-image"
      // Normalize image path and prefer webp if available
      const cleanPath = liveSet.image.replace("./reference-image/", "./image/shows/").replace("reference-image/", "image/shows/")
      const webpPath = cleanPath.replace(/\.(png|jpe?g)$/i, ".webp")
      image.src = webpPath
      image.onerror = () => { image.src = cleanPath }
      image.alt = `${liveSet.title} live performance`
      image.width = 300
      image.height = 300
      image.loading = "lazy"
      image.decoding = "async"

      const info = document.createElement("div")
      info.className = "live-set-info"

      const title = document.createElement("h4")
      title.className = "live-set-title"

      const icon = document.createElement("img")
      icon.className = "live-card-youtube-icon"
      icon.src = "icon/youtube-white.png"
      icon.alt = ""
      icon.width = 24
      icon.height = 24
      icon.loading = "lazy"

      const youtubeIcon = document.createElement("span")
      youtubeIcon.className = "live-set-youtube"
      youtubeIcon.setAttribute("aria-hidden", "true")
      youtubeIcon.append(icon)

      const titleText = document.createElement("span")
      titleText.className = "live-set-title-text"
      titleText.textContent = liveSet.title

      title.append(youtubeIcon, titleText)
      info.append(title)
      card.append(image, info)
      fragment.append(card)
    }

    container.replaceChildren(fragment)
  } catch (error) {
    console.error(`Error loading ${source}:`, error)
    const status = document.createElement("p")
    status.className = "show-list-status"
    status.textContent = "Live sets are currently unavailable."
    container.replaceChildren(status)
  }
}

// Initial hydration
const liveSetsContainer = document.querySelector("[data-live-sets]")
if (liveSetsContainer) {
  loadLiveSets(liveSetsContainer)
}

const pastShowsContainer = document.querySelector('[data-show-panel="past-shows"]')
if (pastShowsContainer) {
  loadPastShows(pastShowsContainer)
}

// Delegated tracking dispatcher (works with dynamically loaded elements)
document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-track]")
  if (!target) return
  window.dispatchEvent(
    new CustomEvent("weng:track", {
      detail: {
        action: target.dataset.track,
        href: target instanceof HTMLAnchorElement ? target.href : undefined,
      },
    }),
  )
})
