# conatus_work 开发 / 构建 / 打包入口。
# 用法：make help
# 版本号默认取 shell/pubspec.yaml，可用 `make package VERSION=0.2.0` 覆盖。

SHELL := /bin/bash
.DEFAULT_GOAL := help
.NOTPARALLEL:

ROOT       := $(CURDIR)
UI_DIR     := $(ROOT)/ui
SHELL_DIR  := $(ROOT)/shell
DIST_DIR   := $(ROOT)/dist
APP_NAME   := conatus_work_shell
APP_PATH   := $(SHELL_DIR)/build/macos/Build/Products/Release/$(APP_NAME).app
VERSION    ?= $(shell sed -n 's/^version: *//p' $(SHELL_DIR)/pubspec.yaml | head -1 | sed 's/+.*//')
ZIP        := $(DIST_DIR)/conatus-work-$(VERSION)-macos.zip

.PHONY: help setup dev dev-web build-ui build-shell bundle package \
        test test-dart test-ui test-shell analyze clean

help:
	@printf '%s\n' \
	  'conatus_work 命令入口' \
	  '' \
	  '  make setup        安装依赖（dart / ui / shell）' \
	  '  make dev          构建前端后启动 macOS 壳（flutter run）' \
	  '  make dev-web      只启动前端开发服务器（浏览器 + fixture 回放）' \
	  '  make build-ui     构建前端（tsc + vite）' \
	  '  make build-shell  构建 macOS 壳（release）' \
	  '  make bundle       构建并内嵌前端与任务卡到 .app' \
	  '  make package      完整打包 zip 到 dist/' \
	  '  make test         跑 Dart 与前端测试' \
	  '  make test-dart    只跑 Dart 测试' \
	  '  make test-ui      只跑前端测试（Vitest）' \
	  '  make test-shell   只跑 Flutter 壳测试' \
	  '  make analyze      静态检查（dart analyze + tsc）' \
	  '  make clean        清理构建产物（保留 var/ 运行记录）'

setup:
	@echo "==> dart pub get"
	cd $(ROOT) && dart pub get
	@echo "==> npm ci"
	cd $(UI_DIR) && npm ci
	@echo "==> flutter pub get"
	cd $(SHELL_DIR) && flutter pub get

dev: build-ui
	@echo "==> flutter run -d macos"
	cd $(SHELL_DIR) && flutter run -d macos

dev-web:
	@echo "==> vite dev server"
	cd $(UI_DIR) && npm run dev

build-ui:
	@echo "==> 构建前端"
	cd $(UI_DIR) && npm run build

build-shell:
	@echo "==> 构建 macOS 壳"
	cd $(SHELL_DIR) && flutter build macos --release

bundle: build-ui build-shell
	@echo "==> 内嵌前端与任务卡"
	bash $(SHELL_DIR)/tool/bundle_ui.sh "$(APP_PATH)"

package: bundle
	@mkdir -p $(DIST_DIR)
	@echo "==> 打包 $(ZIP)"
	@rm -f "$(ZIP)"
	cd $(ROOT) && ditto -c -k --sequesterRsrc --keepParent "$(APP_PATH)" "$(ZIP)"
	@echo "完成：$(ZIP)"

test: test-dart test-ui

test-dart:
	@echo "==> dart test"
	cd $(ROOT) && dart test

test-ui:
	@echo "==> vitest"
	cd $(UI_DIR) && npm test

test-shell:
	@echo "==> flutter test"
	cd $(SHELL_DIR) && flutter test

analyze:
	@echo "==> dart analyze"
	cd $(ROOT) && dart analyze --fatal-infos
	@echo "==> tsc --noEmit"
	cd $(UI_DIR) && npm run lint

clean:
	@echo "==> 清理构建产物"
	rm -rf $(UI_DIR)/dist $(SHELL_DIR)/build $(DIST_DIR)
