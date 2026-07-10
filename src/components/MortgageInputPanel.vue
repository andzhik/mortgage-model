<template>
  <section class="panel editor-section" aria-labelledby="mortgage-inputs-heading">
    <div class="panel-heading">
      <h2 id="mortgage-inputs-heading">Mortgage inputs</h2>
      <span class="status-pill">Draft</span>
    </div>

    <form class="input-grid">
      <label>
        Mortgage amount
        <input type="number" value="500000" min="0" step="1000" />
      </label>
      <label>
        Start date
        <input type="date" value="2026-07-08" />
      </label>
      <label>
        Amortization years
        <input type="number" value="25" min="0" step="1" />
      </label>
      <label>
        Amortization months
        <input type="number" value="0" min="0" max="11" step="1" />
      </label>
      <label>
        Current term
        <select>
          <option>5 years</option>
          <option>3 years</option>
          <option>Custom</option>
        </select>
      </label>
      <label>
        Annual interest rate
        <input type="number" value="5.00" min="0" step="0.01" />
      </label>
      <label>
        Payment frequency
        <select>
          <option>Monthly</option>
          <option>Semi-monthly</option>
          <option>Bi-weekly</option>
          <option>Weekly</option>
        </select>
      </label>
    </form>
  </section>
</template>
