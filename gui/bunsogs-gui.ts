import blessed from 'blessed'

const screen = blessed.screen({
  smartCSR: true,
  dockBorders: true
})
screen.title = 'Bunsogs GUI'

const box = blessed.box({
  top: 'center',
  left: 'center',
  width: '50%',
  height: '50%',
  tags: true,
  border: {
    type: 'line'
  },
  style: {
    fg: 'white',
    border: {
      fg: '#f0f0f0'
    },
  },
  padding: {
    top: 1,
    bottom: 1,
    left: 2,
    right: 2
  }
})

const button1 = blessed.button({
  tags: true,
  content: '{center}Click me!{/center}',
  style: {
    fg: 'white',
    bg: 'blue',
    border: {
      fg: '#f0f0f0'
    },
    hover: {
      bg: 'green'
    }
  }
})

const button2 = blessed.button({
  tags: true,
  content: '{center}Click me!{/center}',
  style: {
    fg: 'white',
    bg: 'blue',
    border: {
      fg: '#f0f0f0'
    },
    hover: {
      bg: 'green'
    }
  }
})

box.append(button1)
box.append(button2)

screen.append(box)

screen.key(['escape', 'q', 'C-c'], function (ch, key) {
  return process.exit(0)
})

box.focus()

screen.render()