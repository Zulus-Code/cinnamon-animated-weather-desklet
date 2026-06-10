# Makefile — Animated Weather Desklet for Cinnamon
# Targets: install, uninstall, reinstall

UUID       = weather-animated@zulus
DESTDIR   ?= $(HOME)/.local/share/cinnamon/desklets/$(UUID)
VERSION    = 2.2.0

JS_FILES   = desklet.js constants.js weatherService.js renderer.js \
             particleSystem.js sceneBuilder.js utils.js
CONFIG     = metadata.json settings-schema.json stylesheet.css
ALL_FILES  = $(JS_FILES) $(CONFIG)

.PHONY: install uninstall reinstall

install: $(DESTDIR)
	@echo "☀️  Installing Animated Weather Desklet v$(VERSION)..."
	cp $(ALL_FILES) $(DESTDIR)/
	cp -r po $(DESTDIR)/
	printf '%s' '$(VERSION)' > $(DESTDIR)/.version
	@echo '✅  Installed to $(DESTDIR)'
	@echo ''
	@echo '   Restart Cinnamon:  Ctrl+Alt+Esc'
	@echo '   Then add desklet:  Right-click desktop → Add desklet → Animated Weather'

$(DESTDIR):
	mkdir -p $@

uninstall:
	@echo '🗑️  Removing Animated Weather Desklet...'
	@if [ -d '$(DESTDIR)' ]; then \
		rm -rf '$(DESTDIR)'; \
		echo '✅  Removed'; \
	else \
		echo 'ℹ️  Not installed'; \
	fi

reinstall: uninstall install
