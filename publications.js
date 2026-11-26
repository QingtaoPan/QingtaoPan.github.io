/* Filter existing HTML entries; all publications remain available without JavaScript. */
(() => {
  const container = document.getElementById('pub-card-container');
  const cards = Array.from(container.querySelectorAll('.pub-card'));
  const search = document.getElementById('pub-search');
  const viewButtons = Array.from(document.querySelectorAll('[data-view]'));
  const topicButtons = Array.from(document.querySelectorAll('[data-topic]'));
  const topics = topicButtons.map(button => button.dataset.topic).filter(topic => topic !== 'All');
  const categories = card => JSON.parse(card.dataset.categories);
  let mode = 'selected';
  let activeTopic = 'All';

  function heading(text) {
    const element = document.createElement('h3');
    element.className = 'group-heading';
    element.textContent = text;
    return element;
  }

  function render() {
    const term = search.value.toLowerCase().trim();
    const filtered = cards.filter(card =>
      (mode !== 'selected' || card.dataset.selected === 'true') &&
      (activeTopic === 'All' || categories(card).includes(activeTopic)) &&
      (!term || card.dataset.search.includes(term))
    );
    container.replaceChildren();
    if (mode === 'topic' && activeTopic === 'All' && !term) {
      topics.forEach(topic => {
        const group = filtered.filter(card => categories(card).includes(topic));
        if (!group.length) return;
        container.append(heading(topic));
        group.forEach(card => container.append(card.cloneNode(true)));
      });
    } else {
      let year;
      filtered.forEach(card => {
        if (mode === 'date' && year !== card.dataset.year) {
          year = card.dataset.year;
          container.append(heading(year));
        }
        container.append(card);
      });
    }
    viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === mode)));
    topicButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.topic === activeTopic)));
    document.getElementById('pub-count').textContent = `${filtered.length} publication${filtered.length === 1 ? '' : 's'}`;
    document.querySelector('.no-results').hidden = filtered.length !== 0;
  }

  viewButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.view;
    render();
  }));
  topicButtons.forEach(button => button.addEventListener('click', () => {
    activeTopic = button.dataset.topic;
    // A topic selection searches all publications in that topic.
    if (activeTopic !== 'All' && mode === 'selected') mode = 'topic';
    render();
  }));
  search.addEventListener('input', render);
  document.getElementById('clear-filters').addEventListener('click', () => {
    mode = 'date';
    activeTopic = 'All';
    search.value = '';
    render();
  });
  document.querySelector('.view-modes').hidden = false;
  document.querySelector('.publication-controls').hidden = false;
  render();
})();
