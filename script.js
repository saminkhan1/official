const showViewButtons = document.querySelectorAll("[data-show-view]")
const showPanels = document.querySelectorAll("[data-show-panel]")

const siteNav = document.querySelector(".site-nav")
const navMenuToggle = document.querySelector(".nav-menu-toggle")
const primaryNavigation = document.querySelector("#primary-navigation")

// Reusable date formatter to avoid allocating ICU objects inside loops
const showDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
})

function closeMobileNavigation() {
  siteNav?.classList.remove("is-open")
  document.body.style.overflow = ""
  navMenuToggle?.setAttribute("aria-expanded", "false")
  navMenuToggle?.setAttribute("aria-label", "Open navigation")
}

function openMobileNavigation() {
  siteNav?.classList.add("is-open")
  document.body.style.overflow = "hidden"
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

primaryNavigation?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMobileNavigation)
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && siteNav?.classList.contains("is-open")) {
    closeMobileNavigation()
    navMenuToggle?.focus()
  }
})

window.matchMedia("(min-width: 881px)").addEventListener("change", (event) => {
  if (event.matches) {
    closeMobileNavigation()
  }
})

showViewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const activeView = button.dataset.showView
    showViewButtons.forEach((viewButton) => {
      viewButton.setAttribute("aria-pressed", String(viewButton === button))
    })
    showPanels.forEach((panel) => {
      panel.hidden = panel.dataset.showPanel !== activeView
    })
  })
})

async function loadPastShows(showList) {
  const source = "data/all-shows.json"
  try {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`Unable to load ${source}: ${response.status}`)
    }

    const shows = await response.json()
    if (!Array.isArray(shows)) {
      throw new Error(`${source} must contain a list of shows`)
    }

    // Fault-tolerant parsing: skip malformed items without crashing entire list
    const visibleShows = []
    for (const show of shows) {
      if (!show?.display || !show.title || !show.location || !show["full-date"]) {
        continue
      }
      const parsedDate = new Date(show["full-date"])
      if (Number.isNaN(parsedDate.getTime())) {
        continue
      }
      visibleShows.push({ ...show, parsedDate })
    }

    visibleShows.sort((first, second) => second.parsedDate - first.parsedDate)

    if (!visibleShows.length) {
      throw new Error(`No visible shows found in ${source}`)
    }

    const rows = visibleShows.map((show) => {
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
      return row
    })

    showList.replaceChildren(...rows)
  } catch (error) {
    console.error(`Unable to load all shows from ${source}.`, error)
    if (!showList.querySelector(".show-row")) {
      const status = document.createElement("p")
      status.className = "show-list-status"
      status.textContent = "All shows are currently unavailable."
      showList.replaceChildren(status)
    }
  }
}

async function loadLiveSets(showList) {
  const source = "data/live-sets.json"
  try {
    const response = await fetch(source)
    if (!response.ok) {
      throw new Error(`Unable to load ${source}: ${response.status}`)
    }

    const liveSets = await response.json()
    if (!Array.isArray(liveSets) || liveSets.length === 0) {
      throw new Error(`${source} must contain at least one live set`)
    }

    const cards = liveSets.map((liveSet) => {
      if (
        typeof liveSet.title !== "string" ||
        typeof liveSet.image !== "string" ||
        typeof liveSet.youtube !== "string"
      ) {
        throw new Error(`${source} contains a live set with missing details`)
      }

      const card = document.createElement("a")
      card.className = "live-set-card"
      card.href = liveSet.youtube
      card.target = "_blank"
      card.rel = "noopener noreferrer"
      card.setAttribute("aria-label", `${liveSet.title} on YouTube`)

      const image = document.createElement("img")
      image.className = "live-set-image"
      image.src = liveSet.image
      image.alt = ""
      image.loading = "lazy"

      const info = document.createElement("div")
      info.className = "live-set-info"

      const title = document.createElement("h4")
      title.className = "live-set-title"

      const icon = document.createElement("img")
      icon.className = "live-card-youtube-icon"
      icon.src = "icon/youtube-white.png"
      icon.alt = ""

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
      return card
    })

    showList.replaceChildren(...cards)
  } catch (error) {
    console.error(`Unable to load live sets from ${source}.`, error)
    if (!showList.querySelector(".live-set-card")) {
      const status = document.createElement("p")
      status.className = "show-list-status"
      status.textContent = "Live sets are currently unavailable."
      showList.replaceChildren(status)
    }
  }
}

const liveSetsList = document.querySelector("[data-live-sets]")
if (liveSetsList) {
  loadLiveSets(liveSetsList)
}

const pastShowsList = document.querySelector('[data-show-panel="past-shows"]')
if (pastShowsList) {
  loadPastShows(pastShowsList)
}

// Delegated click tracking (handles both static and dynamically loaded elements)
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
