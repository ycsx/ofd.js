/**
 * Advanced Example - OFD Document Processing
 * This example demonstrates advanced features of ofd.js including:
 * - Batch processing multiple pages
 * - Custom error handling
 * - Performance optimization
 * - Export and rendering at different scales
 */

import { 
  parseOfdDocument, 
  renderPage, 
  renderOfdByScale,
  calPageBox,
  setPageScale
} from '../index.js';

class OFDViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.document = null;
    this.currentPage = 0;
    this.isRendering = false;
  }

  /**
   * Load OFD document from file
   */
  async loadDocument(file) {
    return new Promise((resolve, reject) => {
      parseOfdDocument({
        ofd: file,
        success: ([ofdDocument]) => {
          if (!ofdDocument) {
            reject(new Error('The OFD file contains no documents'));
            return;
          }
          this.document = ofdDocument;
          this.currentPage = 0;
          resolve(ofdDocument);
        },
        fail: (error) => {
          reject(new Error(`Failed to load OFD: ${error.message}`));
        }
      });
    });
  }

  /**
   * Get page information
   */
  getPageInfo(pageIndex = this.currentPage) {
    if (!this.document || pageIndex < 0 || pageIndex >= this.document.pages.length) {
      return null;
    }

    const page = this.document.pages[pageIndex];
    const box = calPageBox(this.container.clientWidth || 1024, this.document.document, page);

    return {
      index: pageIndex,
      width: box.w,
      height: box.h,
      number: pageIndex + 1,
      total: this.document.pages.length
    };
  }

  createPageElement(pageIndex) {
    const { width, height } = this.getPageInfo(pageIndex);
    const { pages, tpls, fontResObj, drawParamResObj, multiMediaResObj } = this.document;
    const element = document.createElement('div');
    element.style.position = 'relative';
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
    renderPage(element, pages[pageIndex], tpls, fontResObj, drawParamResObj, multiMediaResObj);
    return element;
  }

  /**
   * Render current page
   */
  async renderCurrentPage() {
    if (this.isRendering) {
      console.warn('Already rendering, please wait...');
      return;
    }

    this.isRendering = true;

    try {
      this.container.replaceChildren(this.createPageElement(this.currentPage));
      console.log(`Rendered page ${this.currentPage + 1}`);
    } catch (error) {
      console.error('Rendering failed:', error);
      this.showError(`Failed to render page: ${error.message}`);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Navigate to specific page
   */
  async goToPage(pageIndex) {
    if (pageIndex < 0 || pageIndex >= this.document.pages.length) {
      console.warn(`Invalid page index: ${pageIndex}`);
      return;
    }

    this.currentPage = pageIndex;
    await this.renderCurrentPage();
  }

  /**
   * Render with custom scale
   */
  async renderWithScale(scale) {
    if (this.isRendering) {
      console.warn('Already rendering, please wait...');
      return;
    }

    this.isRendering = true;

    try {
      setPageScale(scale);
      const pages = renderOfdByScale(this.document);
      this.container.replaceChildren(...pages);
      console.log(`Rendered at ${scale * 100}% scale`);
    } catch (error) {
      console.error('Rendering failed:', error);
      this.showError(`Failed to render: ${error.message}`);
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Batch render pages for export
   */
  async renderAllPages() {
    const results = [];

    for (let i = 0; i < this.document.pages.length; i++) {
      try {
        // Create a temporary container for each page
        const tempContainer = this.createPageElement(i);
        tempContainer.id = `page-${i}`;
        tempContainer.style.display = 'none';
        this.container.appendChild(tempContainer);

        results.push({ page: i + 1, status: 'success' });

        console.log(`✓ Page ${i + 1} rendered`);
      } catch (error) {
        results.push({ page: i + 1, status: 'failed', error: error.message });
        console.error(`✗ Page ${i + 1} failed: ${error.message}`);
      }
    }

    return results;
  }

  /**
   * Get document statistics
   */
  getDocumentStats() {
    if (!this.document) return null;

    const stats = {
      totalPages: this.document.pages.length,
      pages: []
    };

    this.document.pages.forEach((page, index) => {
      const { width, height } = this.getPageInfo(index);
      stats.pages.push({
        index,
        width: Math.round(width * 100) / 100,
        height: Math.round(height * 100) / 100,
        area: Math.round(width * height * 100) / 100
      });
    });

    return stats;
  }

  /**
   * Show error message
   */
  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = `⚠ ${message}`;
    this.container.appendChild(errorDiv);

    setTimeout(() => errorDiv.remove(), 5000);
  }
}

// Export for use in other modules
export default OFDViewer;

// Example usage (if this file is used in a browser context)
if (typeof window !== 'undefined') {
  window.OFDViewer = OFDViewer;

  // Quick start example
  document.addEventListener('DOMContentLoaded', () => {
    // Initialize viewer
    const viewer = new OFDViewer('ofdContainer');

    // Set up file input
    const fileInput = document.getElementById('ofdInput');
    if (fileInput) {
      fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
          console.log('Loading document...');
          await viewer.loadDocument(file);

          // Display stats
          const stats = viewer.getDocumentStats();
          console.log('Document Statistics:', stats);

          // Render first page
          await viewer.renderCurrentPage();
        } catch (error) {
          console.error('Error:', error);
          viewer.showError(error.message);
        }
      });
    }
  });
}
