# Hacker News archive data

This directory is intentionally excluded from Git and Docker build contexts. The application reads monthly Parquet files at runtime, using this layout:

```text
data/
  2011/2011-01.parquet
  ...
  2025/2025-12.parquet
```

The full `open-index/hacker-news` archive is available at <https://huggingface.co/datasets/open-index/hacker-news>. Download or transfer its `data/YYYY/YYYY-MM.parquet` files into this directory, preserving the year subdirectories. The application uses the previous 15 calendar years in UTC. Missing files are reported in the interface rather than treated as empty years. Leap day has results only for leap years.

The original data snapshot in this working directory was downloaded at revision `c54ced5973b95d80cd934b8921f44ec8d87c3cd1`; see the local `.snapshot.json` for verification details. Later snapshots can differ.

The dataset is licensed under [ODC-By 1.0](https://huggingface.co/datasets/open-index/hacker-news). User-generated content may have additional rights. Scores, moderation flags and comment counts reflect the archive snapshot; they are not historical front-page rankings.
