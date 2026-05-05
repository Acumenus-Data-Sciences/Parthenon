"""Static registry mapping ``type_name`` strings to Node classes."""

from __future__ import annotations

from runtime.nodes.anonymizer import AnonymizerNode
from runtime.nodes.base import Node
from runtime.nodes.csv_reader import CsvReaderNode
from runtime.nodes.db_reader import DbReaderNode
from runtime.nodes.db_writer import DbWriterNode
from runtime.nodes.dicom_metadata import DicomMetadataNode
from runtime.nodes.fhir_resource import FhirResourceNode
from runtime.nodes.generic_file import GenericFileNode
from runtime.nodes.note_nlp import NoteNlpNode
from runtime.nodes.py2table import Py2TableNode
from runtime.nodes.python_node import PythonNode
from runtime.nodes.r_node import RNode
from runtime.nodes.sql_node import SqlNode

NODE_REGISTRY: dict[str, type[Node]] = {
    PythonNode.type_name: PythonNode,
    SqlNode.type_name: SqlNode,
    CsvReaderNode.type_name: CsvReaderNode,
    DbReaderNode.type_name: DbReaderNode,
    DbWriterNode.type_name: DbWriterNode,
    Py2TableNode.type_name: Py2TableNode,
    GenericFileNode.type_name: GenericFileNode,
    RNode.type_name: RNode,
    FhirResourceNode.type_name: FhirResourceNode,
    DicomMetadataNode.type_name: DicomMetadataNode,
    AnonymizerNode.type_name: AnonymizerNode,
    NoteNlpNode.type_name: NoteNlpNode,
}


def get_node_class(type_name: str) -> type[Node]:
    if type_name not in NODE_REGISTRY:
        raise KeyError(f"unknown node type_name: {type_name!r}")
    return NODE_REGISTRY[type_name]
