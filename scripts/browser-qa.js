async (page) => {
  const results = [];
  const prefix = (await page.evaluate(() => navigator.userAgent)).includes('Edg/') ? 'edge' : 'chrome';
  for (const [width, height] of [[2560, 1440], [1920, 1080], [3840, 2160]]) {
    await page.setViewportSize({ width, height });
    await page.screenshot({ path: `output/playwright/${prefix}-${width}x${height}.png`, scale: 'css' });
    results.push(await page.evaluate(() => {
      const main = document.querySelector('main').getBoundingClientRect();
      const spec = document.querySelector('.spec').getBoundingClientRect();
      const footer = document.querySelector('footer').getBoundingClientRect();
      const canvas = document.querySelector('canvas');
      const gl = canvas.getContext('webgl2');
      return {
        width: innerWidth, height: innerHeight,
        noOverflow: document.documentElement.scrollWidth === innerWidth && document.documentElement.scrollHeight === innerHeight,
        noOverlap: main.right < spec.left && spec.bottom < footer.top,
        webgl2: !!gl, canvasWidth: canvas.width, canvasHeight: canvas.height,
        status: document.querySelector('#renderer-status').textContent,
        feedback: document.querySelector('#feedback').textContent,
        userAgent: navigator.userAgent, renderer: gl.getParameter(gl.RENDERER),
        resources: performance.getEntriesByType('resource').map(r => r.name)
      };
    }));
  }
  if (results.some(r => !r.noOverflow || !r.noOverlap || !r.webgl2)) throw new Error(JSON.stringify(results));
  return results;
}
