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
