const showViewButtons = document.querySelectorAll("[data-show-view]")
const showPanels = document.querySelectorAll("[data-show-panel]")

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

    const visibleShows = shows
      .filter(
        (show) =>
          show.display === true &&
          show.title &&
          show.location &&
          show["full-date"],
      )
      .map((show) => {
        const date = new Date(show["full-date"])
        if (Number.isNaN(date.getTime())) {
          throw new Error(`Invalid show date: ${show["full-date"]}`)
        }
        return { ...show, parsedDate: date }
      })
      .sort((first, second) => second.parsedDate - first.parsedDate)

    if (!visibleShows.length) {
      throw new Error(`No visible shows found in ${source}`)
    }

    const rows = visibleShows.map((show) => {
      const row = document.createElement("article")
      row.className = "show-row"

      const date = document.createElement("time")
      date.className = "show-date"
      date.dateTime = show.parsedDate.toISOString().slice(0, 10)
      date.textContent = new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
        .format(show.parsedDate)
        .toLowerCase()

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
    const status = document.createElement("p")
    status.className = "show-list-status"
    status.textContent = "All shows are currently unavailable."
    showList.replaceChildren(status)
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
    const status = document.createElement("p")
    status.className = "show-list-status"
    status.textContent = "Live sets are currently unavailable."
    showList.replaceChildren(status)
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

document.querySelectorAll("[data-track]").forEach((element) => {
  element.addEventListener("click", () => {
    window.dispatchEvent(
      new CustomEvent("weng:track", {
        detail: {
          action: element.dataset.track,
          href: element instanceof HTMLAnchorElement ? element.href : undefined,
        },
      }),
    )
  })
})
window.addEventListener("weng:track", (e) => {
  // Wire up your analytics platform here (e.g. gtag, Plausible, Fathom)
  console.log("[track]", e.detail)
})
