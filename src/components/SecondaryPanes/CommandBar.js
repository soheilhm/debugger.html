const React = require("react");
const { DOM: dom, PropTypes } = React;
const { findDOMNode } = require("react-dom");
const { connect } = require("react-redux");
const { bindActionCreators } = require("redux");
const { getPause, getIsWaitingOnBreak, getShouldPauseOnExceptions,
        getShouldIgnoreCaughtExceptions,
      } = require("../../selectors");
const Svg = require("../shared/Svg");
const ImPropTypes = require("react-immutable-proptypes");
const { formatKeyShortcut } = require("../../utils/text");

const { Services: { appinfo }} = require("devtools-modules");

const actions = require("../../actions");
require("./CommandBar.css");

const isMacOS = (appinfo.OS === "Darwin");

const COMMANDS = ["resume", "stepOver", "stepIn", "stepOut"];

const KEYS = {
  "WINNT": {
    "resume": "F8",
    "pause": "F8",
    "stepOver": "F10",
    "stepIn": "F11",
    "stepOut": "Shift+F11"
  },
  "Darwin": {
    "resume": "Cmd+\\",
    "pause": "Cmd+\\",
    "stepOver": "Cmd+'",
    "stepIn": "Cmd+;",
    "stepOut": "Cmd+Shift+:",
    "stepOutDisplay": "Cmd+Shift+;"
  },
  "Linux": {
    "resume": "F8",
    "pause": "F8",
    "stepOver": "F10",
    "stepIn": "Ctrl+F11",
    "stepOut": "Ctrl+Shift+F11"
  }
};

function getKey(action) {
  return getKeyForOS(appinfo.OS, action);
}

function getKeyForOS(os, action) {
  return KEYS[os][action];
}

function formatKey(action) {
  const key = getKey(`${action}Display`) || getKey(action);
  if (isMacOS) {
    const winKey = getKeyForOS("WINNT", `${action}Display`) ||
                   getKeyForOS("WINNT", action);
    // display both Windows type and Mac specific keys
    return formatKeyShortcut([key, winKey].join(" "));
  }
  return formatKeyShortcut(key);
}

function handlePressAnimation(button) {
  if (!button) {
    return;
  }

  button.style.opacity = "0";
  button.style.transform = "scale(1.3)";
  setTimeout(() => {
    button.style.opacity = "1";
    button.style.transform = "none";
  }, 200);
}

function debugBtn(onClick, type, className, tooltip) {
  className = `${type} ${className}`;
  return dom.span(
    {
      onClick,
      className,
      key: type
    },
    Svg(type, { title: tooltip })
  );
}

const CommandBar = React.createClass({
  propTypes: {
    sources: PropTypes.object,
    selectedSource: PropTypes.object,
    resume: PropTypes.func,
    stepIn: PropTypes.func,
    stepOut: PropTypes.func,
    stepOver: PropTypes.func,
    breakOnNext: PropTypes.func,
    pause: ImPropTypes.map,
    pauseOnExceptions: PropTypes.func,
    shouldPauseOnExceptions: PropTypes.bool,
    shouldIgnoreCaughtExceptions: PropTypes.bool,
    isWaitingOnBreak: PropTypes.bool,
  },

  contextTypes: {
    shortcuts: PropTypes.object
  },

  displayName: "CommandBar",

  componentWillUnmount() {
    const shortcuts = this.context.shortcuts;
    COMMANDS.forEach((action) => shortcuts.off(getKey(action)));
    if (isMacOS) {
      COMMANDS.forEach((action) => shortcuts.off(getKeyForOS("WINNT", action)));
    }
  },

  componentDidMount() {
    const shortcuts = this.context.shortcuts;

    COMMANDS.forEach(action => shortcuts.on(
      getKey(action),
      (_, e) => this.handleEvent(e, action)
    ));

    if (isMacOS) {
      // The Mac supports both the Windows Function keys
      // as well as the Mac non-Function keys
      COMMANDS.forEach(action => shortcuts.on(
        getKeyForOS("WINNT", action),
        (_, e) => this.handleEvent(e, action)
      ));
    }
  },

  handleEvent(e, action) {
    e.preventDefault();
    e.stopPropagation();

    this.props[action]();
    const button = findDOMNode(this).querySelector(`.${action}`);
    handlePressAnimation(button);
  },

  renderStepButtons() {
    const className = this.props.pause ? "active" : "disabled";
    return [
      debugBtn(
        this.props.stepOver,
        "stepOver",
        className,
        L10N.getFormatStr("stepOverTooltip1", formatKey("stepOver"))
      ),
      debugBtn(
        this.props.stepIn,
        "stepIn",
        className,
        L10N.getFormatStr("stepInTooltip1", formatKey("stepIn"))
      ),
      debugBtn(
        this.props.stepOut,
        "stepOut",
        className,
        L10N.getFormatStr("stepOutTooltip1", formatKey("stepOut"))
      )
    ];
  },

  renderPauseButton() {
    const { pause, breakOnNext, isWaitingOnBreak } = this.props;

    if (pause) {
      return debugBtn(
        this.props.resume,
        "resume",
        "active",
        L10N.getFormatStr("resumeButtonTooltip1", formatKey("resume"))
      );
    }

    if (isWaitingOnBreak) {
      return debugBtn(
        null,
        "pause",
        "disabled",
        L10N.getStr("pausePendingButtonTooltip")
      );
    }

    return debugBtn(
      breakOnNext,
      "pause",
      "active",
      L10N.getFormatStr("pauseButtonTooltip1", formatKey("pause"))
    );
  },

  /*
   * The pause on exception button has three states in this order:
   *  1. don't pause on exceptions      [false, false]
   *  2. pause on uncaught exceptions   [true, true]
   *  3. pause on all exceptions        [true, false]
  */
  renderPauseOnExceptions() {
    const { shouldPauseOnExceptions, shouldIgnoreCaughtExceptions,
            pauseOnExceptions } = this.props;

    if (!shouldPauseOnExceptions && !shouldIgnoreCaughtExceptions) {
      return debugBtn(
        () => pauseOnExceptions(true, true),
        "pause-exceptions",
        "enabled",
        L10N.getStr("ignoreExceptions")
      );
    }

    if (shouldPauseOnExceptions && shouldIgnoreCaughtExceptions) {
      return debugBtn(
        () => pauseOnExceptions(true, false),
        "pause-exceptions",
        "uncaught enabled",
        L10N.getStr("pauseOnUncaughtExceptions")
      );
    }

    return debugBtn(
      () => pauseOnExceptions(false, false),
      "pause-exceptions",
      "all enabled",
      L10N.getStr("pauseOnExceptions")
    );
  },

  render() {
    return (
      dom.div(
        { className: "command-bar" },
        this.renderPauseButton(),
        this.renderStepButtons(),
        this.renderPauseOnExceptions()
      )
    );
  }
});

module.exports = connect(
  state => {
    return {
      pause: getPause(state),
      isWaitingOnBreak: getIsWaitingOnBreak(state),
      shouldPauseOnExceptions: getShouldPauseOnExceptions(state),
      shouldIgnoreCaughtExceptions: getShouldIgnoreCaughtExceptions(state),
    };
  },
  dispatch => bindActionCreators(actions, dispatch)
)(CommandBar);
