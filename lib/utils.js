// Utility function to generate URL summary using Jina AI
export async function generateSummary(url) {
  try {
    // Clean the URL first
    let cleanUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      cleanUrl = 'https://' + url;
    }
    
    console.log('Generating summary for:', cleanUrl);
    
    // Use Jina AI Reader API
    const response = await fetch(`https://r.jina.ai/${cleanUrl}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/plain',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
    });
    
    console.log('Response status:', response.status);
    
    if (!response.ok) {
      console.error('API response not ok:', response.status, response.statusText);
      return `Unable to generate summary for this URL. (Status: ${response.status})`;
    }
    
    const summary = await response.text();
    console.log('Raw summary length:', summary.length);
    
    if (!summary || summary.length < 10) {
      return 'Unable to generate summary for this URL.';
    }
    
    // Extract meaningful content and truncate
    const cleanSummary = summary.trim();
    if (cleanSummary.length > 400) {
      return cleanSummary.substring(0, 400) + '...';
    }
    
    return cleanSummary;
  } catch (error) {
    console.error('Error generating summary:', error);
    return 'Unable to generate summary for this URL.';
  }
}

// Utility function to extract favicon URL
export function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=32`;
  } catch (error) {
    return '/favicon.ico';
  }
}

// Utility function to extract page title from URL
export async function getPageTitle(url) {
  try {
    const response = await fetch(`/api/get-title?url=${encodeURIComponent(url)}`);
    const data = await response.json();
    return data.title || new URL(url).hostname;
  } catch (error) {
    return new URL(url).hostname;
  }
}
