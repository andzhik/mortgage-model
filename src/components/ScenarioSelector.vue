<template>
  <header class="scenario-bar" aria-label="Scenario controls">
    <div>
      <p class="eyebrow">Scenario</p>
      <label class="sr-only" for="scenario-select">Current scenario</label>
      <select id="scenario-select" class="scenario-select" aria-label="Current scenario">
        <option>Scenario 1</option>
      </select>
    </div>

    <nav class="scenario-actions" aria-label="Scenario actions">
      <button type="button">New</button>
      <button type="button">Duplicate</button>
      <button type="button">Rename</button>
      <button type="button" class="danger-button">Delete</button>
    </nav>
  </header>
</template>
