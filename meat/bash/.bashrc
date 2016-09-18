alias ls='ls -GF'
alias ll='ls -la'
alias grep='grep --color=auto'

__reset="\e[0m"
__gray="\e[1;30m"
__red="\e[0;31m"
__green="\e[0;32m"
__blue="\e[0;34m"
__magenta="\e[0;35m"
__orange="\e[0;36m"
__yellow="\e[0;33m"

source ~/.vim/plugged/fzf/shell/completion.bash
source ~/.vim/plugged/fzf/shell/key-bindings.bash

git_prompt () {
  if git branch &> /dev/null; then
    local branch=$(git rev-parse --abbrev-ref HEAD)
    local changed=$(git diff --shortstat | cut -d" " -f2)
    local staged=$(git diff --shortstat --cached | cut -d" " -f2)
    local untracked=$(git status --porcelain | grep "^??" | wc -l)

    echo -n "${__reset}with "
    if (( changed )); then
      echo -n "$__yellow$changed changed"
    fi
    if (( staged )); then
      (( changed )) && echo -n ", "
      echo -n "$__orange$staged staged"
    fi
    if (( untracked )); then
      (( changed )) || (( staged )) && echo -n ", "
      echo -n "$__red$untracked untracked"
    fi
 
    echo " ${__reset}on $branch"
  fi
}

show_remote_host () {
  if [ -n "$SSH_CLIENT" ] || [ -n "$SSH_TTY" ]; then
    echo "${__magenta}on @$(hostname) "
  fi
}

my_prompt () {
  PS1="$__gray\t $(show_remote_host)${__blue}in \w $(git_prompt)\n$__orange\u$__reset >"
}

PROMPT_COMMAND=my_prompt
