/* Copyright (C) The Authors 2025 */
package net.freecivx.data;

import java.util.ArrayList;
import java.util.List;

public class Section {
  private final String title;
  private final List<SectionFile.Entry> entries = new ArrayList<>();

  public Section(String title) {
    this.title = title;
  }

  public String getLastEntryName() {
    return entries.getLast().name();
  }

  public void addEntry(SectionFile.Entry entry) {
    entries.add(entry);
  }
}
