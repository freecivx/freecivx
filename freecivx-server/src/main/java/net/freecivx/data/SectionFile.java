/* Copyright (C) The Authors 2025 */
package net.freecivx.data;

import java.io.*;
import java.util.*;

public class SectionFile {
  public record Entry(String name, String value) {}

  private String name;
  private List<Section> sections;
  private Map<String, Entry> entries;
  private boolean allowDuplicates;

  private SectionFile(boolean allowDuplicates) {
    this.sections = new ArrayList<>();
    this.entries = new HashMap<>();
    this.allowDuplicates = allowDuplicates;
  }

  public static SectionFile fromFile(String filename, String sectionName, boolean allowDuplicates) {
    try (BufferedReader reader = new BufferedReader(new FileReader(filename))) {
      var out = fromReader(reader, sectionName, allowDuplicates);
      out.name = filename;
      return out;
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
  }

  public static SectionFile fromInputStream(
      InputStream is, String sectionName, boolean allowDuplicates) {
    try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
      return fromReader(reader, sectionName, allowDuplicates);
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
  }

  /**
   * @param rawReader
   * @param sectionName
   * @param allowDuplicates
   * @return
   */
  public static SectionFile fromReader(
      Reader rawReader, String sectionName, boolean allowDuplicates) {
    try (BufferedReader reader = new BufferedReader(rawReader)) {
      SectionFile secFile = new SectionFile(allowDuplicates);

      String line;
      Section currentSection = null;
      boolean tableState = false;
      int tableLineNo = 0;
      List<String> columns = new ArrayList<>();

      while ((line = reader.readLine()) != null) {
        line = line.trim();
        if (line.isEmpty() || line.startsWith("#")) {
          continue;
        }

        if (line.startsWith("[") && line.endsWith("]")) {
          String sectionTitle = line.substring(1, line.length() - 1);
          if (sectionName == null || sectionName.equals(sectionTitle)) {
            currentSection = new Section(sectionTitle);
            secFile.sections.add(currentSection);
          } else {
            currentSection = null;
          }
          tableState = false;
        } else if (currentSection != null) {
          if (line.equals("}")) {
            tableState = false;
          } else if (tableState) {
            String[] values = line.split(",");
            for (int i = 0; i < values.length; i++) {
              String fieldName =
                  String.format(
                      "%s%d.%s",
                      currentSection.getLastEntryName(),
                      tableLineNo,
                      i < columns.size()
                          ? columns.get(i)
                          : columns.get(columns.size() - 1) + "," + (i - columns.size() + 1));
              Entry entry = new Entry(fieldName, values[i].trim());
              currentSection.addEntry(entry);
              secFile.addEntryToHash(entry);
            }
            tableLineNo++;
          } else {
            String[] parts = line.split("=", 2);
            if (parts.length == 2) {
              String key = parts[0].trim();
              String value = parts[1].trim();
              if (value.startsWith("{")) {
                tableState = true;
                tableLineNo = 0;
                columns = Arrays.asList(value.substring(1).split(","));
              } else {
                Entry entry = new Entry(key, value);
                currentSection.addEntry(entry);
                secFile.addEntryToHash(entry);
              }
            }
          }
        }
      }

      return secFile;
    } catch (IOException e) {
      e.printStackTrace();
      return null;
    }
  }

  private void addEntryToHash(Entry entry) {
    if (entries.containsKey(entry.name()) && !allowDuplicates) {
      throw new IllegalStateException("Duplicate entry: " + entry.name());
    }
    entries.put(entry.name(), entry);
  }

  public String getName() {
    return name;
  }

  public List<Section> getSections() {
    return sections;
  }

  public Map<String, Entry> getEntries() {
    return entries;
  }

  public boolean isAllowDuplicates() {
    return allowDuplicates;
  }
}
