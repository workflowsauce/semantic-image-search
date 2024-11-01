class ImageSearch {
  constructor() {
    this.searchInput = document.getElementById("searchInput");
    this.searchButton = document.getElementById("searchButton");
    this.resultsContainer = document.getElementById("results");
    this.loadingElement = document.getElementById("loading");
    this.noResultsElement = document.getElementById("noResults");
    this.template = document.getElementById("imageCardTemplate");
    this.imageInput = document.getElementById("imageInput");
    this.dropZone = document.body; // Add this line
    this.previewContainer = document.createElement("div");
    this.previewContainer.className = "fullscreen-preview hidden";
    document.body.appendChild(this.previewContainer);
    this.bindEvents();
  }
  bindEvents() {
    this.searchButton.addEventListener("click", () => this.performSearch());
    this.searchInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.performSearch();
      }
    });
    // Move drag and drop events to document.body
    ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
      this.dropZone.addEventListener(eventName, this.preventDefaults);
    });

    // Handle drag and drop styling
    let dragCounter = 0;

    this.dropZone.addEventListener("dragenter", (e) => {
      dragCounter++;
      this.dropZone.classList.add("drag-over");
    });

    this.dropZone.addEventListener("dragleave", (e) => {
      dragCounter--;
      if (dragCounter === 0) {
        this.dropZone.classList.remove("drag-over");
      }
    });

    this.dropZone.addEventListener("drop", async (e) => {
      dragCounter = 0;
      this.dropZone.classList.remove("drag-over");

      // Prevent the browser from opening the image in a new tab
      e.preventDefault();

      // Handle files (like before)
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) {
        this.handleImageSearch(file);
        return;
      }

      // Handle images dragged from other websites
      const html = e.dataTransfer.getData("text/html");
      if (html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const imgSrc = doc.querySelector("img")?.src;

        if (imgSrc) {
          try {
            const response = await fetch(imgSrc);
            const blob = await response.blob();

            // Extract filename from URL or use default
            const url = new URL(imgSrc);
            const urlFilename = url.pathname.split("/").pop();
            const filename = urlFilename || "dragged-image.jpg";

            const file = new File([blob], filename, {
              type: blob.type,
            });
            this.handleImageSearch(file);
          } catch (error) {
            console.error("Error processing dragged image:", error);
          }
        }
      }
    });

    // Handle manual file input
    this.imageInput.addEventListener("change", (e) => {
      if (e.target.files.length > 0) {
        this.handleImageSearch(e.target.files[0]);
      }
    });

    this.resultsContainer.addEventListener('click', async (e) => {
      if (e.target.classList.contains('delete-button')) {
        const imageCard = e.target.closest('.image-card');
        const filename = imageCard.querySelector('.filename').textContent;
        
        if (confirm(`Are you sure you want to delete "${filename}"?`)) {
          try {
            const response = await fetch(`/api/images/${encodeURIComponent(filename)}`, {
              method: 'DELETE'
            });
            
            if (response.ok) {
              imageCard.remove();
            } else {
              alert('Failed to delete image');
            }
          } catch (error) {
            console.error('Error deleting image:', error);
            alert('Error deleting image');
          }
        }
      }
    });
  }

  preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  async handleImageSearch(file) {
    const formData = new FormData();
    formData.append("image", file);

    this.showLoading();

    try {
      const response = await fetch("/api/search/image", {
        method: "POST",
        body: formData,
      });

      const results = await response.json();
      this.displayResults(results);
    } catch (error) {
      console.error("Error searching by image:", error);
      this.resultsContainer.innerHTML = `<div class="error">Image search failed. Please try again.</div>`;
    } finally {
      this.hideLoading();
    }
  }

  async performSearch() {
    const query = this.searchInput.value.trim();
    if (!query) return;
    this.showLoading();
    try {
      const response = await fetch(
        `/api/search?query=${encodeURIComponent(query)}`
      );
      const results = await response.json();
      this.displayResults(results);
    } catch (error) {
      console.error("Search failed:", error);
      this.resultsContainer.innerHTML = `<div class="error"> Search failed. Please try again. </div>`;
    } finally {
      this.hideLoading();
    }
  }
  displayResults(results) {
    this.resultsContainer.innerHTML = "";
    if (!results.length) {
      this.noResultsElement.classList.remove("hidden");
      return;
    }
    this.noResultsElement.classList.add("hidden");
    results.forEach((result) => {
      const card = this.template.content.cloneNode(true);
      const img = card.querySelector(".preview");
      img.src = `/images/${encodeURIComponent(result.entry.filename)}`;
      img.alt = result.entry.filename;

      // Add click handler for preview
      img.addEventListener("click", () => {
        this.showFullscreenPreview(result);
      });

      // Fill in details
      card.querySelector(".filename").textContent = result.entry.filename;
      card.querySelector(".description").textContent =
        result.entry.analysis.description;
      card.querySelector(".extracted-text").textContent =
        result.entry.analysis.extractedText;
      card.querySelector(".similarity").textContent = `Similarity: ${(
        (1 - result.similarity) *
        100
      ).toFixed(1)}%`;
      this.resultsContainer.appendChild(card);
    });
  }

  showFullscreenPreview(result) {
    this.previewContainer.innerHTML = `
      <div class="preview-content">
        <img src="/images/${encodeURIComponent(result.entry.filename)}" alt="${
      result.entry.filename
    }">
        <div class="preview-details">
          <h2>${result.entry.filename}</h2>
          <div class="preview-text">
            <h3>Description</h3>
            <p>${result.entry.analysis.description}</p>
            <h3>Extracted Text</h3>
            <p>${result.entry.analysis.extractedText}</p>
          </div>
        </div>
      </div>
    `;

    this.previewContainer.classList.remove("hidden");
    this.previewContainer.addEventListener("click", () => {
      this.previewContainer.classList.add("hidden");
    });
    this.previewContainer
      .querySelector(".preview-content")
      .addEventListener("click", (e) => {
        e.stopPropagation();
      });
  }
  showLoading() {
    this.loadingElement.classList.remove("hidden");
    this.resultsContainer.innerHTML = "";
    this.noResultsElement.classList.add("hidden");
  }
  hideLoading() {
    this.loadingElement.classList.add("hidden");
  }
}
// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  new ImageSearch();
});
