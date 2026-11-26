---
title: '串口联调笔记'
description: '记录 STM32 与 ESP32 串口联调时检查的参数和会话流程。'
publishedAt: 2026-11-26
kind: tech
category: 嵌入式
tags: [STM32, ESP32, UART]
draft: true
featured: false
---

先确认两块板的串口参数一致，再观察启动时的收发日志。

## 检查串口参数

- 检查波特率、数据位和停止位。
- 检查两块板是否共地。

### 观察会话日志

收到 `READY` 后开始发送后续指令。

```text
STM32 → ESP32: HELLO
ESP32 → STM32: READY
```
